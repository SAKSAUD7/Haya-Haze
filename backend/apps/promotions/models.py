import secrets
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel


class Coupon(TimeStampedModel):
    class Kind(models.TextChoices):
        PERCENT = "percent", "Percentage off"
        FLAT = "flat", "Flat amount off"
        FREE_SHIPPING = "free_shipping", "Free shipping"
        BOGO = "bogo", "Buy one get one (cheapest free)"

    code = models.CharField(max_length=30, unique=True)
    description = models.CharField(max_length=160, blank=True)
    kind = models.CharField(max_length=14, choices=Kind.choices, default=Kind.PERCENT)
    value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"), help_text="Percent or rupees, by type.")
    max_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Cap for percentage coupons.")
    min_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Total redemptions allowed. Empty = unlimited.")
    per_customer_limit = models.PositiveSmallIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0, editable=False)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    first_order_only = models.BooleanField(default=False)
    collections = models.ManyToManyField("catalog.Collection", blank=True, help_text="Limit to these collections.")
    products = models.ManyToManyField("catalog.Product", blank=True, help_text="Limit to these products.")
    auto_apply = models.BooleanField(default=False, help_text="Apply automatically when the bag qualifies.")
    is_active = models.BooleanField(default=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        super().save(*args, **kwargs)

    def is_live(self) -> bool:
        now = timezone.now()
        if not self.is_active:
            return False
        if self.starts_at and self.starts_at > now:
            return False
        if self.expires_at and self.expires_at < now:
            return False
        return not (self.usage_limit is not None and self.used_count >= self.usage_limit)


class CouponRedemption(TimeStampedModel):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="redemptions")
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="coupon_redemption")
    email = models.EmailField(db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)


def _gift_code() -> str:
    raw = secrets.token_hex(8).upper()
    return f"HH-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"


class GiftCard(TimeStampedModel):
    code = models.CharField(max_length=24, unique=True, default=_gift_code)
    initial_balance = models.DecimalField(max_digits=10, decimal_places=2)
    balance = models.DecimalField(max_digits=10, decimal_places=2)
    recipient_email = models.EmailField(blank=True)
    note = models.CharField(max_length=200, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    history = HistoricalRecords()

    def __str__(self):
        return f"{self.code} (₹{self.balance})"

    def save(self, *args, **kwargs):
        if self._state.adding and self.balance is None:
            self.balance = self.initial_balance
        super().save(*args, **kwargs)

    def is_usable(self) -> bool:
        return self.is_active and self.balance > 0 and (self.expires_at is None or self.expires_at > timezone.now())


class Subscriber(TimeStampedModel):
    email = models.EmailField(unique=True)
    source = models.CharField(max_length=30, default="footer")
    is_active = models.BooleanField(default=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email
