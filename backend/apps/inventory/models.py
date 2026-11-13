from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class StockMovement(TimeStampedModel):
    class Reason(models.TextChoices):
        SALE = "sale", "Sale"
        RESTOCK = "restock", "Restock"
        ADJUSTMENT = "adjustment", "Manual adjustment"
        RETURN = "return", "Customer return"
        CANCELLATION = "cancellation", "Order cancelled"

    variant = models.ForeignKey("catalog.Variant", on_delete=models.CASCADE, related_name="movements")
    delta = models.IntegerField(help_text="Positive adds stock, negative removes it.")
    stock_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=14, choices=Reason.choices)
    reference = models.CharField(max_length=60, blank=True, help_text="Order number or note.")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.variant.sku} {self.delta:+d}"


class StockReservation(TimeStampedModel):
    """Stock held for an order awaiting payment. Released on failure or expiry."""

    class State(models.TextChoices):
        HELD = "held", "Held"
        COMMITTED = "committed", "Committed (sold)"
        RELEASED = "released", "Released"

    variant = models.ForeignKey("catalog.Variant", on_delete=models.CASCADE, related_name="reservations")
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="reservations")
    quantity = models.PositiveIntegerField()
    state = models.CharField(max_length=10, choices=State.choices, default=State.HELD, db_index=True)
    expires_at = models.DateTimeField(db_index=True)

    def __str__(self):
        return f"{self.variant.sku} × {self.quantity} ({self.state})"


class BackInStockRequest(TimeStampedModel):
    variant = models.ForeignKey("catalog.Variant", on_delete=models.CASCADE, related_name="back_in_stock_requests")
    email = models.EmailField()
    notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["variant", "email"], name="unique_back_in_stock")]

    def __str__(self):
        return f"{self.email} → {self.variant.sku}"
