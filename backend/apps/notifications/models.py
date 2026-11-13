from django.db import models


class NotificationLog(models.Model):
    """One row per email (or WhatsApp message) the store sends."""

    channel = models.CharField(max_length=10, default="email")
    template = models.CharField(max_length=40, db_index=True)
    recipient = models.CharField(max_length=254, db_index=True)
    subject = models.CharField(max_length=200, blank=True)
    reference = models.CharField(max_length=40, blank=True, help_text="Order number, etc.")
    success = models.BooleanField(default=True)
    error = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.template} → {self.recipient}"
