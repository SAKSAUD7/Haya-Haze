from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.contrib.filters.admin import ChoicesDropdownFilter, RangeDateFilter
from unfold.decorators import display

from .models import BackInStockRequest, StockMovement


@admin.register(StockMovement)
class StockMovementAdmin(ModelAdmin):
    list_display = ["created_at", "variant", "change", "stock_after", "reason", "reference", "user"]
    list_filter = [("reason", ChoicesDropdownFilter), ("created_at", RangeDateFilter)]
    list_filter_submit = True
    search_fields = ["variant__sku", "variant__product__name", "reference"]
    list_select_related = ["variant__product", "user"]
    list_per_page = 60
    show_full_result_count = False

    @display(description="Change", ordering="delta", label={"in": "success", "out": "danger"})
    def change(self, obj):
        return ("in" if obj.delta > 0 else "out"), f"{obj.delta:+d}"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(BackInStockRequest)
class BackInStockRequestAdmin(ModelAdmin):
    list_display = ["email", "variant", "created_at", "state"]
    list_filter = ["notified_at"]
    search_fields = ["email", "variant__sku", "variant__product__name"]
    list_select_related = ["variant__product"]

    @display(description="Status", label={"Notified": "success", "Waiting": "warning"})
    def state(self, obj):
        return "Notified" if obj.notified_at else "Waiting"
