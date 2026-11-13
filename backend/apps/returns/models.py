from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class ReturnRequest(TimeStampedModel):
    class Kind(models.TextChoices):
        RETURN = "return", "Return for refund"
        EXCHANGE = "exchange", "Exchange"

    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        APPROVED = "approved", "Approved"
        PICKUP_SCHEDULED = "pickup_scheduled", "Pickup scheduled"
        RECEIVED = "received", "Received"
        REFUNDED = "refunded", "Refunded"
        EXCHANGED = "exchanged", "Exchange sent"
        REJECTED = "rejected", "Rejected"

    class Reason(models.TextChoices):
        SIZE = "size", "Size or length did not fit"
        COLOUR = "colour", "Colour looked different"
        QUALITY = "quality", "Quality not as expected"
        DAMAGED = "damaged", "Arrived damaged"
        WRONG = "wrong_item", "Wrong item received"
        OTHER = "other", "Something else"

    OPEN = (Status.REQUESTED, Status.APPROVED, Status.PICKUP_SCHEDULED, Status.RECEIVED)

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="return_requests")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="return_requests")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.RETURN)
    reason = models.CharField(max_length=12, choices=Reason.choices)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=18, choices=Status.choices, default=Status.REQUESTED, db_index=True)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    admin_note = models.TextField(blank=True, help_text="Shared with the customer in status emails.")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} · {self.order.number}"


class ReturnItem(models.Model):
    request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name="items")
    order_item = models.ForeignKey("orders.OrderItem", on_delete=models.CASCADE, related_name="return_items")
    quantity = models.PositiveSmallIntegerField(default=1)

    def __str__(self):
        return f"{self.order_item.product_name} × {self.quantity}"


class ReturnPhoto(models.Model):
    request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="returns/")
