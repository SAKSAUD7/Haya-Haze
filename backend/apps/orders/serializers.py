import re

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.shipping.models import Shipment

from .models import Order, OrderEvent, OrderItem

PHONE_RE = re.compile(r"^(\+?91)?[6-9]\d{9}$")
PIN_RE = re.compile(r"^[1-9]\d{5}$")


class CheckoutAddressSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=120)
    line1 = serializers.CharField(max_length=200)
    line2 = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")
    landmark = serializers.CharField(max_length=120, allow_blank=True, required=False, default="")
    city = serializers.CharField(max_length=80)
    state = serializers.CharField(max_length=80)
    pincode = serializers.CharField(max_length=10)
    country = serializers.CharField(max_length=2, required=False, default="IN")

    def validate_pincode(self, value):
        if not PIN_RE.match(value.strip()):
            raise serializers.ValidationError("Enter a valid 6-digit pincode.")
        return value.strip()


class PlaceOrderSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(min_length=16, max_length=64)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    address = CheckoutAddressSerializer()
    shipping_method = serializers.ChoiceField(choices=Order.ShippingMethod.choices, default="standard")
    payment_method = serializers.ChoiceField(choices=["razorpay", "cod", "stripe"])
    save_address = serializers.BooleanField(default=False)
    subscribe = serializers.BooleanField(default=False)

    def validate_phone(self, value):
        digits = re.sub(r"[\s-]", "", value)
        if not PHONE_RE.match(digits):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return digits


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id", "product_name", "product_slug", "variant_label", "sku", "image", "unit_price", "quantity",
            "line_total", "discount",
        ]


class OrderEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OrderEvent
        fields = ["status", "status_label", "note", "created_at"]


class ShipmentSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Shipment
        fields = ["awb", "courier", "tracking_url", "status", "status_label"]


class OrderListSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    grand_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    item_count = serializers.SerializerMethodField()
    thumbnails = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["number", "status", "status_label", "payment_status", "grand_total", "item_count", "thumbnails", "created_at"]

    def get_item_count(self, obj) -> int:
        return sum(i.quantity for i in obj.items.all())

    def get_thumbnails(self, obj) -> list[str]:
        return [i.image for i in obj.items.all() if i.image][:4]


class OrderSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_label = serializers.CharField(source="get_payment_method_display", read_only=True)
    grand_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    events = serializers.SerializerMethodField()
    shipments = ShipmentSerializer(many=True, read_only=True)
    is_cancellable = serializers.BooleanField(read_only=True)
    is_returnable = serializers.BooleanField(read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "number", "status", "status_label", "payment_status", "payment_method", "payment_method_label",
            "shipping_method", "email", "phone", "ship_name", "ship_line1", "ship_line2", "ship_landmark",
            "ship_city", "ship_state", "ship_pincode", "subtotal", "discount_total", "shipping_total", "cod_fee",
            "gift_wrap_fee", "tax_total", "tax_included", "gift_card_amount", "total", "grand_total",
            "refunded_total", "coupon_code", "gift_wrap", "gift_note", "customer_note", "created_at", "placed_at",
            "delivered_at", "items", "events", "shipments", "is_cancellable", "is_returnable", "progress",
        ]

    @extend_schema_field(OrderEventSerializer(many=True))
    def get_events(self, obj):
        return OrderEventSerializer([e for e in obj.events.all() if e.is_public], many=True).data

    def get_progress(self, obj) -> int:
        """Index in the normal fulfilment flow (0-5), or -1 when cancelled/returned."""
        return Order.FLOW.index(obj.status) if obj.status in Order.FLOW else -1


class PlaceOrderResponseSerializer(serializers.Serializer):
    order = OrderSerializer()
    # null when nothing needs paying now (COD or fully covered by a gift card)
    payment = serializers.DictField(allow_null=True)
    access_token = serializers.CharField(help_text="Lets a guest view this order without signing in.")


class TrackOrderSerializer(serializers.Serializer):
    number = serializers.CharField(max_length=16)
    email = serializers.EmailField()
