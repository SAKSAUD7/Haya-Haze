from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin
from unfold.contrib.import_export.forms import ExportForm, ImportForm
from unfold.decorators import display

from .models import Coupon, GiftCard, Subscriber


@admin.register(Coupon)
class CouponAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = ["code", "kind", "offer", "min_order_value", "usage", "expires_at", "auto_apply", "state"]
    list_filter = ["kind", "is_active", "auto_apply"]
    search_fields = ["code", "description"]
    autocomplete_fields = ["collections", "products"]
    readonly_fields = ["used_count"]
    fieldsets = [
        (None, {"fields": ["code", "description", ("kind", "value", "max_discount"), "is_active", "auto_apply"]}),
        ("Conditions", {"fields": ["min_order_value", ("starts_at", "expires_at"), "first_order_only", "collections", "products"]}),
        ("Limits", {"fields": [("usage_limit", "per_customer_limit"), "used_count"]}),
    ]

    @display(description="Offer")
    def offer(self, obj):
        return {
            "percent": f"{obj.value:g}% off", "flat": f"₹{obj.value:g} off",
            "free_shipping": "Free shipping", "bogo": "Buy 1 get 1",
        }[obj.kind]

    @display(description="Used")
    def usage(self, obj):
        return f"{obj.used_count} / {obj.usage_limit or '∞'}"

    @display(description="Status", label={"Live": "success", "Off": "danger"})
    def state(self, obj):
        return "Live" if obj.is_live() else "Off"


@admin.register(GiftCard)
class GiftCardAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = ["code", "initial_balance", "balance", "recipient_email", "expires_at", "is_active"]
    search_fields = ["code", "recipient_email"]
    list_filter = ["is_active"]
    fields = ["code", "initial_balance", "balance", "recipient_email", "note", "expires_at", "is_active"]

    def get_readonly_fields(self, request, obj=None):
        return ["code", "initial_balance"] if obj else ["code", "balance"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.balance = obj.initial_balance
        super().save_model(request, obj, form, change)


class SubscriberResource(resources.ModelResource):
    class Meta:
        model = Subscriber
        import_id_fields = ["email"]
        fields = ["email", "source", "is_active", "created_at"]


@admin.register(Subscriber)
class SubscriberAdmin(ImportExportModelAdmin, ModelAdmin):
    resource_classes = [SubscriberResource]
    import_form_class = ImportForm
    export_form_class = ExportForm
    list_display = ["email", "source", "is_active", "created_at"]
    list_filter = ["is_active", "source"]
    search_fields = ["email"]
    show_full_result_count = False
