from decimal import Decimal

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.catalog.models import Category, Collection, Product, Variant
from apps.core.models import SiteSettings
from apps.promotions.models import Coupon

ADDRESS = {"full_name": "Test Buyer", "line1": "12 Rose Villa", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def cfg(db):
    return SiteSettings.load()


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def make_variant(db):
    category = Category.objects.create(name="Scarves", slug="scarves")
    collection = Collection.objects.create(name="Haze", slug="haze")
    counter = {"n": 0}

    def make(price="1000", stock=5, gst="5", **extra) -> Variant:
        counter["n"] += 1
        n = counter["n"]
        product = Product.objects.create(
            name=f"Scarf {n}", slug=f"scarf-{n}", category=category, primary_collection=collection,
            price=Decimal(price), gst_rate=Decimal(gst), status=Product.Status.ACTIVE, **extra,
        )
        product.collections.add(collection)
        return Variant.objects.create(product=product, sku=f"SKU-{n}", color_name="Rose", stock=stock)

    return make


@pytest.fixture
def coupon(db):
    return Coupon.objects.create(code="WELCOME10", kind=Coupon.Kind.PERCENT, value=Decimal("10"), per_customer_limit=1)


def add(client, variant, quantity=1):
    return client.post("/api/v1/cart/items/", {"variant_id": variant.id, "quantity": quantity}, format="json")


def place(client, key="idem-key-0000000001", method="razorpay", **overrides):
    payload = {
        "idempotency_key": key, "email": "buyer@example.com", "phone": "9876543210", "address": ADDRESS,
        "shipping_method": "standard", "payment_method": method, **overrides,
    }
    return client.post("/api/v1/checkout/place/", payload, format="json")
