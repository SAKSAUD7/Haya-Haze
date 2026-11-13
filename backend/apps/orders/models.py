import secrets
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel

ZERO = Decimal("0")


def generate_order_number() -> str:
    return f"HH{timezone.now():%y%m}{secrets.randbelow(10**6):06d}"


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending payment"
        CONFIRMED = "confirmed", "Confirmed"
        PACKED = "packed", "Packed"
        SHIPPED = "shipped", "Shipped"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"
        RETURNED = "returned", "Returned"
        REFUNDED = "refunded", "Refunded"

    class PaymentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    class PaymentMethod(models.TextChoices):
        RAZORPAY = "razorpay", "Razorpay (UPI, cards, netbanking)"
        COD = "cod", "Cash on Delivery"
        STRIPE = "stripe", "Stripe (international cards)"
        GIFT_CARD = "gift_card", "Gift card"

    class ShippingMethod(models.TextChoices):
        STANDARD = "standard", "Standard"
        EXPRESS = "express", "Express"

    # The forward path an order normally follows; used by the admin "advance" action.
    FLOW = [Status.PENDING, Status.CONFIRMED, Status.PACKED, Status.SHIPPED, Status.OUT_FOR_DELIVERY, Status.DELIVERED]

    number = models.CharField(max_length=16, unique=True, default=generate_order_number, editable=False)
    idempotency_key = models.CharField(max_length=64, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="orders")
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=20)

    status = models.CharField(max_length=18, choices=Status.choices, default=Status.PENDING, db_index=True)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, db_index=True)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices)
    cod_verified = models.BooleanField("COD verified", default=False, help_text="Tick after confirming the COD order with the customer.")
    shipping_method = models.CharField(max_length=10, choices=ShippingMethod.choices, default=ShippingMethod.STANDARD)

    # Shipping address snapshot
    ship_name = models.CharField(max_length=120)
    ship_line1 = models.CharField(max_length=200)
    ship_line2 = models.CharField(max_length=200, blank=True)
    ship_landmark = models.CharField(max_length=120, blank=True)
    ship_city = models.CharField(max_length=80)
    ship_state = models.CharField(max_length=80)
    ship_pincode = models.CharField(max_length=10, db_index=True)
    ship_country = models.CharField(max_length=2, default="IN")

    # Money (all server-calculated)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    shipping_total = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    cod_fee = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    gift_wrap_fee = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    tax_total = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    tax_included = models.BooleanField(default=True)
    gift_card_amount = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    total = models.DecimalField(max_digits=10, decimal_places=2, help_text="Amount payable after gift card.")
    refunded_total = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    coupon_code = models.CharField(max_length=30, blank=True)
    gift_card_code = models.CharField(max_length=24, blank=True)

    gift_wrap = models.BooleanField(default=False)
    gift_note = models.CharField(max_length=300, blank=True)
    customer_note = models.CharField(max_length=500, blank=True)
    internal_notes = models.TextField(blank=True, help_text="Staff only.")
    placed_at = models.DateTimeField(null=True, blank=True, db_index=True, help_text="When the order was confirmed.")
    delivered_at = models.DateTimeField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return self.number

    @property
    def grand_total(self) -> Decimal:
        """Value of the order including any part covered by a gift card."""
        return self.total + self.gift_card_amount

    @property
    def is_cancellable(self) -> bool:
        return self.status in (self.Status.PENDING, self.Status.CONFIRMED, self.Status.PACKED)

    @property
    def is_returnable(self) -> bool:
        if self.status != self.Status.DELIVERED or not self.delivered_at:
            return False
        return (timezone.now() - self.delivered_at).days <= 7

    @property
    def shipping_address_text(self) -> str:
        parts = [self.ship_line1, self.ship_line2, self.ship_landmark, f"{self.ship_city}, {self.ship_state} {self.ship_pincode}"]
        return ", ".join(p for p in parts if p)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.Variant", null=True, on_delete=models.SET_NULL, related_name="+")
    product = models.ForeignKey("catalog.Product", null=True, on_delete=models.SET_NULL, related_name="order_items")
    product_name = models.CharField(max_length=140)
    product_slug = models.CharField(max_length=160, blank=True)
    variant_label = models.CharField(max_length=80, blank=True)
    sku = models.CharField(max_length=60)
    image = models.CharField(max_length=300, blank=True)
    hsn_code = models.CharField(max_length=12, blank=True)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveSmallIntegerField()
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    line_total = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO)
    weight_grams = models.PositiveIntegerField(default=150)

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"


class OrderEvent(models.Model):
    """Timeline entries: status changes and notes, shown to the customer when public."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=18, choices=Order.Status.choices, blank=True)
    note = models.CharField(max_length=300, blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.order.number}: {self.status or self.note}"
