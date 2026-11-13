from django.contrib import admin, messages
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.contrib.filters.admin import ChoicesDropdownFilter
from unfold.decorators import action, display

from apps.core.exceptions import CommerceError
from apps.notifications.tasks import send_return_update_email
from apps.orders import services as order_services
from apps.orders.models import Order
from apps.payments.services import refund_order

from .models import ReturnItem, ReturnPhoto, ReturnRequest

S = ReturnRequest.Status


class ReturnItemInline(TabularInline):
    model = ReturnItem
    extra = 0
    can_delete = False
    fields = ["order_item", "quantity"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


class ReturnPhotoInline(TabularInline):
    model = ReturnPhoto
    extra = 0
    can_delete = False
    fields = ["preview"]
    readonly_fields = ["preview"]

    @display(description="Photo")
    def preview(self, obj):
        return format_html('<a href="{0}" target="_blank"><img src="{0}" style="max-height:160px;border-radius:12px"></a>', obj.image.url)

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(ReturnRequest)
class ReturnRequestAdmin(ModelAdmin):
    list_display = ["order", "kind", "reason", "customer", "refund_amount", "state", "created_at"]
    list_filter = [("status", ChoicesDropdownFilter), "kind", "reason"]
    list_filter_submit = True
    search_fields = ["order__number", "order__email"]
    list_select_related = ["order"]
    inlines = [ReturnItemInline, ReturnPhotoInline]
    readonly_fields = ["order", "user", "kind", "reason", "details", "status", "created_at"]
    fields = ["order", "user", ("kind", "reason"), "details", "status", "refund_amount", "admin_note", "created_at"]
    actions_detail = ["approve", "schedule_pickup", "mark_received", "complete", "reject"]

    def has_add_permission(self, request):
        return False

    @display(description="Customer")
    def customer(self, obj):
        return obj.order.email

    @display(description="Status", ordering="status", label={
        "Requested": "warning", "Approved": "info", "Pickup scheduled": "info", "Received": "info",
        "Refunded": "success", "Exchange sent": "success", "Rejected": "danger",
    })
    def state(self, obj):
        return obj.get_status_display()

    def _move(self, request, object_id, allowed_from, new_status, message):
        req = ReturnRequest.objects.select_related("order").get(pk=object_id)
        if req.status not in allowed_from:
            self.message_user(request, f"This request is already '{req.get_status_display()}'.", messages.WARNING)
        else:
            req.status = new_status
            req.save(update_fields=["status", "updated_at"])
            send_return_update_email.delay(req.pk)
            self.message_user(request, message)
        return redirect(reverse("admin:returns_returnrequest_change", args=[object_id]))

    @action(description="Approve", url_path="approve", icon="check")
    def approve(self, request, object_id):
        return self._move(request, object_id, [S.REQUESTED], S.APPROVED, "Approved. The customer has been emailed.")

    @action(description="Pickup scheduled", url_path="pickup", icon="local_shipping")
    def schedule_pickup(self, request, object_id):
        return self._move(request, object_id, [S.APPROVED], S.PICKUP_SCHEDULED, "Marked as pickup scheduled.")

    @action(description="Item received", url_path="received", icon="inventory")
    def mark_received(self, request, object_id):
        return self._move(request, object_id, [S.APPROVED, S.PICKUP_SCHEDULED], S.RECEIVED, "Marked as received.")

    @action(description="Refund / send exchange", url_path="complete", icon="payments")
    def complete(self, request, object_id):
        """Final step: refund the customer (returns) or mark the exchange as sent."""
        req = ReturnRequest.objects.select_related("order").get(pk=object_id)
        back = redirect(reverse("admin:returns_returnrequest_change", args=[object_id]))
        if req.status != S.RECEIVED:
            self.message_user(request, "Mark the item as received first.", messages.WARNING)
            return back
        try:
            if req.kind == ReturnRequest.Kind.RETURN:
                if req.refund_amount > 0:
                    refund_order(req.order, amount=req.refund_amount, reason="Return", user=request.user)
                if req.order.status == Order.Status.DELIVERED:
                    order_services.transition(req.order, Order.Status.RETURNED, user=request.user, notify=False)
                req.status = S.REFUNDED
            else:
                req.status = S.EXCHANGED
        except CommerceError as exc:
            self.message_user(request, str(exc.detail), messages.ERROR)
            return back
        req.save(update_fields=["status", "updated_at"])
        send_return_update_email.delay(req.pk)
        self.message_user(request, "Done. The customer has been emailed.")
        return back

    @action(description="Reject", url_path="reject", icon="close")
    def reject(self, request, object_id):
        return self._move(
            request, object_id, [S.REQUESTED, S.APPROVED], S.REJECTED,
            "Rejected. Add a note for the customer in 'Admin note' so they know why.",
        )
