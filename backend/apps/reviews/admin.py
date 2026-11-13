from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.contrib.filters.admin import ChoicesDropdownFilter
from unfold.decorators import action, display

from .models import Review


@admin.register(Review)
class ReviewAdmin(ModelAdmin):
    list_display = ["stars", "product", "name", "excerpt", "is_verified_buyer", "is_featured", "state", "created_at"]
    list_display_links = ["stars", "excerpt"]
    list_editable = ["is_featured"]
    list_filter = [("status", ChoicesDropdownFilter), "rating", "is_verified_buyer", "is_featured"]
    list_filter_submit = True
    search_fields = ["name", "title", "body", "product__name"]
    list_select_related = ["product"]
    autocomplete_fields = ["product", "user"]
    actions = ["approve", "reject", "feature"]
    readonly_fields = ["photo_preview"]
    fields = [
        "product", "user", ("name", "location"), "rating", "title", "body", "photo", "photo_preview",
        "is_verified_buyer", ("status", "is_featured"), "admin_reply",
    ]

    @display(description="Rating", ordering="rating")
    def stars(self, obj):
        return "★" * obj.rating + "☆" * (5 - obj.rating)

    @display(description="Review")
    def excerpt(self, obj):
        return obj.title or (obj.body[:60] + "…" if len(obj.body) > 60 else obj.body)

    @display(description="Status", ordering="status", label={"Approved": "success", "Awaiting moderation": "warning", "Rejected": "danger"})
    def state(self, obj):
        return obj.get_status_display()

    @display(description="Photo")
    def photo_preview(self, obj):
        return format_html('<img src="{}" style="max-height:180px;border-radius:12px">', obj.photo.url) if obj.photo else "—"

    def _set(self, request, queryset, **fields):
        product_ids = set(queryset.values_list("product_id", flat=True))
        n = queryset.update(**fields)
        for pid in product_ids:
            Review.refresh_product_rating(pid)
        self.message_user(request, f"{n} review(s) updated.")

    @action(description="Approve selected")
    def approve(self, request, queryset):
        self._set(request, queryset, status=Review.Status.APPROVED)

    @action(description="Reject selected")
    def reject(self, request, queryset):
        self._set(request, queryset, status=Review.Status.REJECTED, is_featured=False)

    @action(description="Approve and feature on the home page")
    def feature(self, request, queryset):
        self._set(request, queryset, status=Review.Status.APPROVED, is_featured=True)
