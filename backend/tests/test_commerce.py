"""Checkout, payments and stock: the paths where a bug costs money."""
import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import StockMovement, StockReservation
from apps.inventory.tasks import release_expired_reservations
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.payments.providers.razorpay_provider import SANDBOX_SECRET, _sign
from apps.promotions.models import Coupon, GiftCard

from .conftest import add, place

pytestmark = pytest.mark.django_db


def pay(client, provider_order_id):
    return client.post("/api/v1/payments/sandbox/pay/", {"provider_order_id": provider_order_id}, format="json")


# --- pricing -----------------------------------------------------------------------

def test_cart_totals_are_calculated_on_the_server(client, make_variant, cfg):
    variant = make_variant(price="1000", gst="5")
    data = add(client, variant, 1).json()
    assert data["item_count"] == 1
    assert Decimal(data["subtotal"]) == Decimal("1000")
    assert Decimal(data["shipping"]) == cfg.standard_shipping_rate  # below the free-shipping threshold
    assert Decimal(data["total"]) == Decimal("1000") + cfg.standard_shipping_rate
    # GST is included in the price: 1000 - 1000/1.05
    assert Decimal(data["tax_total"]) == Decimal("47.62")
    assert Decimal(data["free_shipping_remaining"]) == cfg.free_shipping_threshold - Decimal("1000")


def test_free_shipping_above_threshold(client, make_variant):
    data = add(client, make_variant(price="1600")).json()
    assert data["shipping_free"] is True
    assert Decimal(data["total"]) == Decimal("1600")


def test_percent_coupon_and_per_customer_limit(client, make_variant, coupon):
    variant = make_variant(price="2000", stock=10)
    add(client, variant)
    data = client.post("/api/v1/cart/coupon/", {"code": "welcome10"}, format="json").json()
    assert data["coupon_code"] == "WELCOME10"
    assert Decimal(data["discount"]) == Decimal("200")
    assert Decimal(data["total"]) == Decimal("1800")

    first = place(client, key="coupon-order-000001", method="cod")
    assert first.status_code == 201
    coupon.refresh_from_db()
    assert coupon.used_count == 1

    # Same customer, second order: the code is refused.
    add(client, variant)
    client.post("/api/v1/cart/coupon/", {"code": "WELCOME10"}, format="json")
    again = client.patch("/api/v1/cart/", {"email": "buyer@example.com"}, format="json").json()
    assert again["coupon_code"] == ""


def test_coupon_minimum_order_is_enforced(client, make_variant):
    Coupon.objects.create(code="BIG", kind=Coupon.Kind.FLAT, value=Decimal("300"), min_order_value=Decimal("5000"))
    add(client, make_variant(price="1000"))
    resp = client.post("/api/v1/cart/coupon/", {"code": "BIG"}, format="json")
    assert resp.status_code == 400
    assert resp.json()["code"] == "coupon_minimum"


def test_bogo_makes_the_cheapest_unit_free(client, make_variant):
    Coupon.objects.create(code="BOGO", kind=Coupon.Kind.BOGO)
    add(client, make_variant(price="1000"))
    add(client, make_variant(price="600"))
    data = client.post("/api/v1/cart/coupon/", {"code": "BOGO"}, format="json").json()
    assert Decimal(data["discount"]) == Decimal("600")


# --- prepaid checkout --------------------------------------------------------------

def test_prepaid_checkout_reserves_then_commits_stock(client, make_variant):
    variant = make_variant(price="1000", stock=3)
    add(client, variant, 2)
    resp = place(client)
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["order"]["status"] == "pending"
    assert body["payment"]["sandbox"] is True

    variant.refresh_from_db()
    assert (variant.stock, variant.reserved, variant.available) == (3, 2, 1)  # held, not yet sold

    paid = pay(client, body["payment"]["provider_order_id"])
    assert paid.status_code == 200, paid.json()
    assert paid.json()["status"] == "confirmed"
    assert paid.json()["payment_status"] == "paid"

    variant.refresh_from_db()
    assert (variant.stock, variant.reserved) == (1, 0)
    assert StockMovement.objects.filter(variant=variant, delta=-2, reason="sale").count() == 1
    assert client.get("/api/v1/cart/").json()["item_count"] == 0  # bag emptied after payment


def test_order_creation_is_idempotent(client, make_variant):
    variant = make_variant(stock=5)
    add(client, variant)
    first = place(client, key="same-key-0000000001").json()
    second = place(client, key="same-key-0000000001").json()
    assert first["order"]["number"] == second["order"]["number"]
    assert Order.objects.count() == 1
    variant.refresh_from_db()
    assert variant.reserved == 1  # reserved once, not twice


def test_payment_confirmation_is_idempotent(client, make_variant):
    variant = make_variant(stock=5)
    add(client, variant)
    session = place(client).json()["payment"]
    order_id = session["provider_order_id"]
    payload = {
        "razorpay_order_id": order_id, "razorpay_payment_id": "pay_1",
        "razorpay_signature": _sign(f"{order_id}|pay_1", SANDBOX_SECRET),
    }
    for _ in range(3):  # client callback and webhook can both arrive, more than once
        assert client.post("/api/v1/payments/razorpay/verify/", payload, format="json").status_code == 200
    variant.refresh_from_db()
    assert (variant.stock, variant.reserved) == (4, 0)
    assert StockMovement.objects.filter(variant=variant).count() == 1


def test_forged_signature_is_rejected(client, make_variant):
    variant = make_variant(stock=5)
    add(client, variant)
    body = place(client).json()
    resp = client.post("/api/v1/payments/razorpay/verify/", {
        "razorpay_order_id": body["payment"]["provider_order_id"], "razorpay_payment_id": "pay_x",
        "razorpay_signature": "0" * 64,
    }, format="json")
    assert resp.status_code == 400
    order = Order.objects.get(number=body["order"]["number"])
    assert (order.status, order.payment_status) == ("pending", "pending")


def test_webhook_requires_valid_signature_and_settles(client, make_variant, settings):
    settings.RAZORPAY_WEBHOOK_SECRET = "whsec_test"
    variant = make_variant(stock=5)
    add(client, variant)
    body = place(client).json()
    event = json.dumps({
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_hook", "order_id": body["payment"]["provider_order_id"], "method": "upi"}}},
    }).encode()
    url = "/api/v1/payments/razorpay/webhook/"
    bad = client.post(url, event, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE="nope")
    assert bad.status_code == 403
    assert Order.objects.get().status == "pending"

    signature = hmac.new(b"whsec_test", event, hashlib.sha256).hexdigest()
    good = client.post(url, event, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=signature)
    assert good.status_code == 200
    assert Order.objects.get().status == "confirmed"
    assert Payment.objects.get().method == "upi"


def test_sandbox_endpoint_is_disabled_outside_sandbox(client, make_variant, settings):
    add(client, make_variant())
    session = place(client).json()["payment"]
    settings.PAYMENTS_SANDBOX = False
    assert pay(client, session["provider_order_id"]).status_code == 403


# --- stock -------------------------------------------------------------------------

def test_cannot_oversell_the_last_unit(make_variant):
    variant = make_variant(stock=1)
    alice, bilal = APIClient(), APIClient()
    assert add(alice, variant).status_code == 201
    assert add(bilal, variant).status_code == 201  # both may hold it in their bag

    assert place(alice, key="alice-key-000000001").status_code == 201
    second = place(bilal, key="bilal-key-000000001")
    assert second.status_code == 400
    assert second.json()["code"] == "insufficient_stock"
    assert Order.objects.count() == 1  # the failed attempt left nothing behind
    variant.refresh_from_db()
    assert variant.reserved == 1


def test_unpaid_order_expires_and_releases_stock(client, make_variant):
    variant = make_variant(stock=2)
    add(client, variant, 2)
    number = place(client).json()["order"]["number"]
    variant.refresh_from_db()
    assert variant.available == 0

    StockReservation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
    assert release_expired_reservations() == 1
    variant.refresh_from_db()
    assert (variant.stock, variant.reserved, variant.available) == (2, 0, 2)
    assert Order.objects.get(number=number).status == "cancelled"


def test_cancelling_a_paid_order_restocks_and_refunds(client, make_variant):
    variant = make_variant(stock=3)
    add(client, variant)
    body = place(client).json()
    pay(client, body["payment"]["provider_order_id"])
    number, token = body["order"]["number"], body["access_token"]

    resp = client.post(f"/api/v1/orders/{number}/cancel/?token={token}")
    assert resp.status_code == 200, resp.json()
    assert resp.json()["status"] == "cancelled"
    variant.refresh_from_db()
    assert (variant.stock, variant.reserved) == (3, 0)
    order = Order.objects.get(number=number)
    assert order.payment_status == "refunded"
    assert order.refunded_total == order.total


def test_quantity_is_capped_at_available_stock(client, make_variant):
    variant = make_variant(stock=2)
    data = add(client, variant, 5).json()
    assert data["items"][0]["quantity"] == 2
    assert "Only 2 available" in data["issues"][0]


# --- cash on delivery --------------------------------------------------------------

def test_cod_order_confirms_immediately_with_fee(client, make_variant, cfg):
    variant = make_variant(price="1600", stock=4)
    add(client, variant)
    body = place(client, method="cod").json()
    assert body["payment"] is None
    order = body["order"]
    assert (order["status"], order["payment_status"]) == ("confirmed", "pending")
    assert Decimal(order["cod_fee"]) == cfg.cod_fee
    assert Decimal(order["total"]) == Decimal("1600") + cfg.cod_fee
    variant.refresh_from_db()
    assert (variant.stock, variant.reserved) == (3, 0)


def test_cod_is_refused_above_the_limit(client, make_variant, cfg):
    cfg.cod_max_order = Decimal("2000")
    cfg.save()
    add(client, make_variant(price="2500"))
    assert client.get("/api/v1/cart/").json()["cod_available"] is False
    resp = place(client, method="cod")
    assert resp.status_code == 400
    assert resp.json()["code"] == "cod_unavailable"
    assert Order.objects.count() == 0


def test_gift_card_covering_the_whole_order(client, make_variant):
    card = GiftCard.objects.create(code="HH-TEST-CARD", initial_balance=Decimal("5000"), balance=Decimal("5000"))
    add(client, make_variant(price="1600"))
    cart = client.post("/api/v1/cart/gift-card/", {"code": "hh-test-card"}, format="json").json()
    assert Decimal(cart["total"]) == 0
    body = place(client, method="razorpay").json()
    assert body["payment"] is None
    assert (body["order"]["status"], body["order"]["payment_status"]) == ("confirmed", "paid")
    card.refresh_from_db()
    assert card.balance == Decimal("3400")


# --- access ------------------------------------------------------------------------

def test_guest_order_needs_its_access_token(client, make_variant):
    add(client, make_variant())
    body = place(client, method="cod").json()
    number = body["order"]["number"]
    stranger = APIClient()
    assert stranger.get(f"/api/v1/orders/{number}/").status_code == 404
    assert stranger.get(f"/api/v1/orders/{number}/?token=forged").status_code == 404
    assert stranger.get(f"/api/v1/orders/{number}/?token={body['access_token']}").status_code == 200
    tracked = stranger.post("/api/v1/orders/track/", {"number": number, "email": "buyer@example.com"}, format="json")
    assert tracked.status_code == 200
    wrong = stranger.post("/api/v1/orders/track/", {"number": number, "email": "other@example.com"}, format="json")
    assert wrong.status_code == 404


def test_unserviceable_or_invalid_pincode_is_rejected(client, make_variant, cfg):
    add(client, make_variant())
    bad = dict(full_name="A", line1="B", city="C", state="D", pincode="12")
    assert place(client, address=bad).status_code == 400
    cfg.ship_to_unlisted_pincodes = False
    cfg.save()
    resp = place(client, key="pin-key-00000000001")
    assert resp.status_code == 400 and resp.json()["code"] == "unserviceable"


def test_checkout_releases_lapsed_holds_without_a_scheduler(make_variant, settings):
    """With no Celery beat (Render free plan), the next checkout frees stock that an
    abandoned unpaid order was holding."""
    settings.CELERY_TASK_ALWAYS_EAGER = True
    variant = make_variant(stock=1)
    first, second = APIClient(), APIClient()
    add(first, variant)
    number = place(first, key="lapsed-hold-0000001").json()["order"]["number"]
    StockReservation.objects.update(expires_at=timezone.now() - timedelta(minutes=1))

    add(second, variant)
    assert place(second, key="lapsed-hold-0000002").status_code == 201
    assert Order.objects.get(number=number).status == "cancelled"
