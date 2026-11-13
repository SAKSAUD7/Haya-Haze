import uuid

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Cart(TimeStampedModel):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="cart")
    email = models.EmailField(blank=True, help_text="Captured at checkout; used for abandoned-cart recovery.")
    coupon = models.ForeignKey("promotions.Coupon", null=True, blank=True, on_delete=models.SET_NULL)
    gift_card = models.ForeignKey("promotions.GiftCard", null=True, blank=True, on_delete=models.SET_NULL)
    gift_wrap = models.BooleanField(default=False)
    gift_note = models.CharField(max_length=300, blank=True)
    order_note = models.CharField(max_length=500, blank=True)
    recovery_email_sent_at = models.DateTimeField(null=True, blank=True)
    recovered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "cart"

    def __str__(self):
        return f"Cart {str(self.token)[:8]} ({self.user or self.email or 'guest'})"

    def active_items(self):
        return self.items.filter(saved_for_later=False)


class CartItem(TimeStampedModel):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    variant = models.ForeignKey("catalog.Variant", on_delete=models.CASCADE, related_name="+")
    quantity = models.PositiveSmallIntegerField(default=1)
    saved_for_later = models.BooleanField(default=False)

    MAX_QUANTITY = 10

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["cart", "variant"], name="unique_cart_variant")]

    def __str__(self):
        return f"{self.variant} × {self.quantity}"
