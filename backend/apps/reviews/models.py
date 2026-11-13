from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count

from apps.core.models import TimeStampedModel


class Review(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting moderation"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews")
    name = models.CharField(max_length=80)
    location = models.CharField(max_length=80, blank=True)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    title = models.CharField(max_length=120, blank=True)
    body = models.TextField()
    photo = models.ImageField(upload_to="reviews/", blank=True)
    is_verified_buyer = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    is_featured = models.BooleanField(default=False, help_text="Show in the home page reviews carousel.")
    admin_reply = models.TextField("Reply from Haya & Haze", blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.rating}★ {self.product.name} — {self.name}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.refresh_product_rating(self.product_id)

    def delete(self, *args, **kwargs):
        product_id = self.product_id
        result = super().delete(*args, **kwargs)
        self.refresh_product_rating(product_id)
        return result

    @staticmethod
    def refresh_product_rating(product_id: int) -> None:
        from apps.catalog.models import Product

        agg = Review.objects.filter(product_id=product_id, status=Review.Status.APPROVED).aggregate(
            avg=Avg("rating"), count=Count("id")
        )
        Product.objects.filter(pk=product_id).update(rating_average=agg["avg"] or 0, rating_count=agg["count"])
