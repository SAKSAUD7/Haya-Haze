from django.db import models

from apps.core.models import TimeStampedModel


class ServiceablePincode(TimeStampedModel):
    pincode = models.CharField(max_length=10, unique=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    is_serviceable = models.BooleanField(default=True)
    cod_available = models.BooleanField("COD available", default=True)
    standard_days = models.CharField(max_length=10, blank=True, help_text="Override, e.g. 3-4. Empty uses the store default.")
    express_days = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ["pincode"]

    def __str__(self):
        return f"{self.pincode} — {self.city}"


class Shipment(TimeStampedModel):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PICKED_UP = "picked_up", "Picked up"
        IN_TRANSIT = "in_transit", "In transit"
        OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
        DELIVERED = "delivered", "Delivered"
        RTO = "rto", "Returned to origin"
        CANCELLED = "cancelled", "Cancelled"

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, related_name="shipments")
    provider = models.CharField(max_length=20, default="manual")
    provider_shipment_id = models.CharField(max_length=60, blank=True)
    awb = models.CharField("AWB / tracking number", max_length=60, blank=True, db_index=True)
    courier = models.CharField(max_length=80, blank=True)
    tracking_url = models.URLField(blank=True)
    label_url = models.URLField(blank=True)
    status = models.CharField(max_length=18, choices=Status.choices, default=Status.CREATED)
    raw = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order.number} · {self.awb or 'no AWB'}"
