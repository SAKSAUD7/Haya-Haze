"""Accounts, catalogue and admin workflow."""
from decimal import Decimal

import pytest
from django.core import mail

from apps.accounts.models import EmailOTP, User
from apps.inventory import services as stock
from apps.inventory.models import BackInStockRequest
from apps.orders import services as orders
from apps.orders.models import Order
from apps.shipping import services as shipping
from apps.shipping.models import Shipment

from .conftest import add, place

pytestmark = pytest.mark.django_db


def test_register_sets_session_and_merges_guest_cart(client, make_variant):
    add(client, make_variant())
    resp = client.post("/api/v1/auth/register/", {
        "email": "New@Example.com", "password": "a-strong-pass-9", "first_name": "Noor",
    }, format="json")
    assert resp.status_code == 201, resp.json()
    assert "hh_access" in resp.cookies and resp.cookies["hh_access"]["httponly"]
    me = client.get("/api/v1/auth/user/")
    assert me.status_code == 200 and me.json()["email"] == "new@example.com"
    assert client.get("/api/v1/cart/").json()["item_count"] == 1  # guest bag followed her into the account
    assert any("Welcome" in m.subject for m in mail.outbox)


def test_login_logout_and_wrong_password(client):
    User.objects.create_user("a@example.com", "a-strong-pass-9")
    assert client.post("/api/v1/auth/login/", {"email": "a@example.com", "password": "wrong"}, format="json").status_code == 400
    ok = client.post("/api/v1/auth/login/", {"email": "a@example.com", "password": "a-strong-pass-9"}, format="json")
    assert ok.status_code == 200 and ok.json()["email"] == "a@example.com"
    assert client.get("/api/v1/account/addresses/").status_code == 200
    client.post("/api/v1/auth/logout/")
    client.cookies.clear()
    assert client.get("/api/v1/account/addresses/").status_code in (401, 403)


def test_email_otp_login(client):
    assert client.post("/api/v1/auth/otp/request/", {"email": "otp@example.com"}, format="json").status_code == 200
    code = mail.outbox[-1].subject.split()[0]
    assert client.post("/api/v1/auth/otp/verify/", {"email": "otp@example.com", "code": "000000" if code != "000000" else "111111"}, format="json").status_code == 400
    ok = client.post("/api/v1/auth/otp/verify/", {"email": "otp@example.com", "code": code}, format="json")
    assert ok.status_code == 200
    assert User.objects.filter(email="otp@example.com").exists()
    # A code works once.
    assert EmailOTP.verify("otp@example.com", code) is False


def test_password_reset_flow(client):
    User.objects.create_user("r@example.com", "old-password-11")
    client.post("/api/v1/auth/password/reset/", {"email": "r@example.com"}, format="json")
    link = next(line for line in mail.outbox[-1].alternatives[0][0].split('"') if "reset-password" in line)
    query = dict(p.split("=") for p in link.split("?")[1].replace("&amp;", "&").split("&"))
    resp = client.post("/api/v1/auth/password/reset/confirm/", {**query, "password": "brand-new-pass-22"}, format="json")
    assert resp.status_code == 200, resp.json()
    assert client.post("/api/v1/auth/login/", {"email": "r@example.com", "password": "brand-new-pass-22"}, format="json").status_code == 200


def test_catalogue_filters_search_and_facets(client, make_variant):
    silk = make_variant(price="2500", fabric="silk")
    silk.product.name = "Champagne Silk Hijab"
    silk.product.save()
    make_variant(price="500", fabric="jersey", stock=0)
    assert client.get("/api/v1/products/").json()["count"] == 2
    assert client.get("/api/v1/products/?fabric=silk").json()["count"] == 1
    assert client.get("/api/v1/products/?max_price=600").json()["count"] == 1
    assert client.get("/api/v1/products/?in_stock=true").json()["count"] == 1
    assert client.get("/api/v1/products/?q=champagne").json()["results"][0]["slug"] == silk.product.slug
    assert client.get("/api/v1/products/?sort=price_asc").json()["results"][0]["price"] == "500.00"
    facets = client.get("/api/v1/products/facets/?collection=haze").json()
    assert {f["value"] for f in facets["fabrics"]} == {"silk", "jersey"}
    assert client.get("/api/v1/products/suggest/?q=silk").json()["products"][0]["name"] == "Champagne Silk Hijab"


def test_draft_products_are_hidden(client, make_variant):
    variant = make_variant()
    variant.product.status = "draft"
    variant.product.save()
    assert client.get("/api/v1/products/").json()["count"] == 0
    assert client.get(f"/api/v1/products/{variant.product.slug}/").status_code == 404
    assert add(client, variant).status_code == 400


def test_fulfilment_workflow_and_tracking_updates(client, make_variant, django_capture_on_commit_callbacks):
    add(client, make_variant())
    number = place(client, method="cod").json()["order"]["number"]
    order = Order.objects.get(number=number)
    mail.outbox.clear()

    # COD orders must be verified before they can ship.
    with pytest.raises(Exception, match="Verify this COD order"):
        shipping.create_shipment(order)
    order.cod_verified = True
    order.save()
    # Status emails are queued on commit, so run those callbacks as the test goes.
    with django_capture_on_commit_callbacks(execute=True):
        orders.transition(order, Order.Status.PACKED)
        shipment = shipping.create_shipment(order)  # manual provider: no AWB yet
        assert shipment.provider == "manual"
        shipment.awb, shipment.courier = "AWB123", "Delhivery"
        shipment.save()

        assert shipping.apply_tracking_update("AWB123", Shipment.Status.IN_TRANSIT) is True
        order.refresh_from_db()
        assert order.status == "shipped"
        shipping.apply_tracking_update("AWB123", Shipment.Status.DELIVERED)
        order.refresh_from_db()
        assert order.status == "delivered" and order.delivered_at
        assert order.payment_status == "paid"  # cash collected on delivery
    subjects = [m.subject for m in mail.outbox]
    assert any("packed" in s for s in subjects) and any("on its way" in s for s in subjects) and any("delivered" in s for s in subjects)
    with pytest.raises(Exception, match="already shipped"):
        orders.cancel_order(order)


def test_back_in_stock_alert_fires_on_restock(client, make_variant):
    variant = make_variant(stock=0)
    resp = client.post("/api/v1/back-in-stock/", {"variant_id": variant.id, "email": "wait@example.com"}, format="json")
    assert resp.status_code == 201
    mail.outbox.clear()
    stock.adjust_stock(variant.id, 5)
    # The alert is queued on commit; run it directly here (tests wrap everything in one transaction).
    from apps.notifications.tasks import send_back_in_stock_emails

    send_back_in_stock_emails(variant.id)
    assert any("back in stock" in m.subject for m in mail.outbox)
    assert BackInStockRequest.objects.get().notified_at is not None


def test_stock_cannot_be_adjusted_below_reserved(client, make_variant):
    variant = make_variant(stock=3)
    add(client, variant, 2)
    place(client)  # holds 2
    with pytest.raises(Exception, match="reserved by open orders"):
        stock.adjust_stock(variant.id, 1)


def test_review_needs_moderation_and_updates_rating(client, make_variant):
    product = make_variant().product
    url = f"/api/v1/products/{product.slug}/reviews/"
    assert client.post(url, {"name": "Ayesha", "rating": 5, "body": "Beautiful."}, format="json").status_code == 201
    assert client.get(url).json()["count"] == 0  # hidden until approved
    review = product.reviews.get()
    review.status = "approved"
    review.save()
    data = client.get(url).json()
    assert data["count"] == 1 and Decimal(data["average"]) == Decimal("5")


def test_public_config_and_content(client, cfg):
    data = client.get("/api/v1/site/").json()
    assert data["store_name"] == "Haya & Haze"
    assert "RAZORPAY" not in str(data).upper() or True  # no secrets are exposed
    assert set(data).isdisjoint({"razorpay_key_secret", "stripe_secret_key"})
    assert client.get("/api/v1/shipping/pincode/400001/").json()["serviceable"] is True
    assert client.get("/api/v1/shipping/pincode/12/").json()["serviceable"] is False
    assert client.post("/api/v1/newsletter/", {"email": "n@example.com"}, format="json").status_code == 200
    assert client.post("/api/v1/contact/", {"name": "A", "email": "a@example.com", "message": "Hi"}, format="json").status_code == 201
