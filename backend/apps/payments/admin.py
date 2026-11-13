from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from unfold.contrib.filters.admin import ChoicesDropdownFilter, RangeDateFilter
from unfold.decorators import display

from .models import Payment, Refund


class RefundInline(TabularInline):
    model = Refund
    extra = 0
    can_delete = False
    fields = ["amount", "provider_refund_id", "reason", "status", "created_at"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Payment)
class PaymentAdmin(ModelAdmin):
    list_display = ["created_at", "order", "provider", "amount", "method", "state", "provider_payment_id"]
    list_filter = [("status", ChoicesDropdownFilter), ("provider", ChoicesDropdownFilter), ("created_at", RangeDateFilter)]
    list_filter_submit = True
    search_fields = ["order__number", "provider_order_id", "provider_payment_id"]
    list_select_related = ["order"]
    inlines = [RefundInline]
    show_full_result_count = False

    @display(description="Status", label={"Paid": "success", "Created": "warning", "Failed": "danger", "Refunded": "danger"})
    def state(self, obj):
        return obj.get_status_display()

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
