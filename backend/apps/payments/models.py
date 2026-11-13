from django.db import models

from apps.core.models import TimeStampedModel


class Payment(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"
        REFUNDED = "refunded", "Refunded"

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=12)
    provider_order_id = models.CharField(max_length=120, blank=True, db_index=True)
    provider_payment_id = models.CharField(max_length=120, blank=True, db_index=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CREATED, db_index=True)
    method = models.CharField(max_length=30, blank=True, help_text="upi, card, netbanking...")
    is_sandbox = models.BooleanField(default=False)
    raw = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider} {self.amount} ({self.status})"


class Refund(TimeStampedModel):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="refunds")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    provider_refund_id = models.CharField(max_length=120, blank=True)
    reason = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=12, default="processed")

    def __str__(self):
        return f"Refund {self.amount} for {self.payment.order.number}"
