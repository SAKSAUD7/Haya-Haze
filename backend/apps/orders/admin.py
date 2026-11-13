from django.contrib import admin, messages
from django.http import HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ExportActionModelAdmin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, TabularInline
from unfold.contrib.filters.admin import ChoicesDropdownFilter, RangeDateFilter
from unfold.contrib.import_export.forms import ExportForm
from unfold.decorators import action, display

from apps.core.exceptions import CommerceError
from apps.payments.models import Payment
from apps.payments.services import refund_order
from apps.shipping.models import Shipment
from apps.shipping.services import create_shipment

from . import services
from .invoice import render_invoice
from .models import Order, OrderEvent, OrderItem

STATUS_COLOURS = {
    "Pending payment": "warning", "Confirmed": "info", "Packed": "info", "Shipped": "info",
    "Out for delivery": "info", "Delivered": "success", "Cancelled": "danger", "Returned": "danger",
    "Refunded": "danger",
}


class OrderResource(resources.ModelResource):
    class Meta:
        model = Order
        fields = [
            "number", "created_at", "status", "payment_status", "payment_method", "email", "phone", "ship_name",
            "ship_city", "ship_state", "ship_pincode", "subtotal", "discount_total", "shipping_total", "tax_total",
            "total", "coupon_code",
        ]


class ReadOnlyInline(TabularInline):
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class OrderItemInline(ReadOnlyInline):
    model = OrderItem
    fields = ["thumb", "product_name", "variant_label", "sku", "unit_price", "quantity", "discount", "line_total"]
    readonly_fields = fields

    @display(description="")
    def thumb(self, obj):
        return format_html('<img src="{}" class="hh-thumb">', obj.image) if obj.image else ""


class OrderEventInline(TabularInline):
    model = OrderEvent
    extra = 1
    fields = ["status", "note", "is_public", "created_at"]
    readonly_fields = ["status", "created_at"]
    verbose_name_plural = "Timeline (add a note for the customer or the team)"

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class PaymentInline(ReadOnlyInline):
    model = Payment
    fields = ["provider", "provider_payment_id", "amount", "status", "method", "created_at"]
    readonly_fields = fields


class ShipmentInline(TabularInline):
    model = Shipment
    extra = 0
    fields = ["provider", "courier", "awb", "tracking_url", "status"]


@admin.register(Order)
class OrderAdmin(SimpleHistoryAdmin, ExportActionModelAdmin, ModelAdmin):
    resource_classes = [OrderResource]
    export_form_class = ExportForm

    list_display = ["number", "created_at", "customer", "total_display", "state", "payment", "cod_check", "destination"]
    list_filter = [
        ("status", ChoicesDropdownFilter), ("payment_status", ChoicesDropdownFilter),
        ("payment_method", ChoicesDropdownFilter), "cod_verified", ("created_at", RangeDateFilter),
    ]
    list_filter_submit = True
    search_fields = ["number", "email", "phone", "ship_name", "ship_pincode", "shipments__awb"]
    date_hierarchy = "created_at"
    list_per_page = 50
    show_full_result_count = False
    inlines = [OrderItemInline, ShipmentInline, PaymentInline, OrderEventInline]
    actions = ["advance", "verify_cod", "export_admin_action"]
    actions_detail = ["advance_one", "verify_cod_one", "ship_one", "invoice", "packing_slip", "refund_one", "cancel_one"]
    save_on_top = True

    readonly_fields = [
        "number", "user", "status", "payment_status", "payment_method", "shipping_method", "subtotal",
        "discount_total", "shipping_total", "cod_fee", "gift_wrap_fee", "tax_total", "gift_card_amount", "total",
        "refunded_total", "coupon_code", "gift_card_code", "placed_at", "delivered_at", "created_at",
        "gift_wrap", "gift_note", "customer_note",
    ]
    fieldsets = [
        ("Order", {"fields": [("number", "status"), ("payment_method", "payment_status", "cod_verified"), ("created_at", "placed_at", "delivered_at")]}),
        ("Customer", {"fields": ["user", ("email", "phone")]}),
        ("Ship to", {"fields": ["ship_name", "ship_line1", "ship_line2", "ship_landmark", ("ship_city", "ship_state", "ship_pincode"), "shipping_method"]}),
        ("Totals", {"fields": [("subtotal", "discount_total", "coupon_code"), ("shipping_total", "cod_fee", "gift_wrap_fee"), ("tax_total", "gift_card_amount", "gift_card_code"), ("total", "refunded_total")]}),
        ("Notes", {"fields": [("gift_wrap", "gift_note"), "customer_note", "internal_notes"]}),
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    @display(description="Customer", ordering="ship_name")
    def customer(self, obj):
        return format_html("{}<br><small style='opacity:.6'>{}</small>", obj.ship_name, obj.email)

    @display(description="Total", ordering="total")
    def total_display(self, obj):
        return f"₹{obj.grand_total:,.0f}"

    @display(description="Status", ordering="status", label=STATUS_COLOURS)
    def state(self, obj):
        return obj.get_status_display()

    @display(description="Payment", label={"Paid": "success", "Pending": "warning", "Failed": "danger", "Refunded": "danger"})
    def payment(self, obj):
        return obj.get_payment_status_display()

    @display(description="Method")
    def cod_check(self, obj):
        if obj.payment_method != Order.PaymentMethod.COD:
            return obj.payment_method.title()
        return "COD ✓ verified" if obj.cod_verified else "COD · verify"

    @display(description="Ship to", ordering="ship_pincode")
    def destination(self, obj):
        return f"{obj.ship_city} {obj.ship_pincode}"

    def save_formset(self, request, form, formset, change):
        if formset.model is OrderEvent:
            for event in formset.save(commit=False):
                event.created_by = request.user
                event.save()
            return
        super().save_formset(request, form, formset, change)

    # --- workflow -----------------------------------------------------------
    def _back(self, object_id):
        return redirect(reverse("admin:orders_order_change", args=[object_id]))

    def _run(self, request, fn, success: str):
        try:
            fn()
            self.message_user(request, success)
        except CommerceError as exc:
            self.message_user(request, str(exc.detail), messages.ERROR)

    def _advance(self, order, user):
        nxt = services.next_status(order)
        if nxt is None:
            raise CommerceError(f"{order.number} has no next step.")
        if nxt == Order.Status.SHIPPED and not order.shipments.exclude(awb="").exists():
            raise CommerceError(f"{order.number}: create the shipment (or add an AWB) before marking it shipped.")
        services.transition(order, nxt, user=user)

    @action(description="Advance selected to the next status")
    def advance(self, request, queryset):
        done = 0
        for order in queryset:
            try:
                self._advance(order, request.user)
                done += 1
            except CommerceError as exc:
                self.message_user(request, str(exc.detail), messages.WARNING)
        self.message_user(request, f"{done} order(s) advanced. Customers have been notified.")

    @action(description="Mark COD verified")
    def verify_cod(self, request, queryset):
        n = queryset.filter(payment_method=Order.PaymentMethod.COD).update(cod_verified=True)
        self.message_user(request, f"{n} COD order(s) verified.")

    @action(description="Advance to next status", url_path="advance", icon="arrow_forward")
    def advance_one(self, request, object_id):
        order = Order.objects.get(pk=object_id)
        self._run(request, lambda: self._advance(order, request.user), "Order advanced. The customer has been notified.")
        return self._back(object_id)

    @action(description="Verify COD", url_path="verify-cod", icon="verified")
    def verify_cod_one(self, request, object_id):
        Order.objects.filter(pk=object_id, payment_method=Order.PaymentMethod.COD).update(cod_verified=True)
        self.message_user(request, "COD verified.")
        return self._back(object_id)

    @action(description="Create shipment", url_path="ship", icon="local_shipping")
    def ship_one(self, request, object_id):
        order = Order.objects.get(pk=object_id)

        def run():
            shipment = create_shipment(order, user=request.user)
            if not shipment.awb:
                raise CommerceError("Shipment created. Shiprocket is not connected, so enter the courier and AWB in the Shipments section below, then advance the order.")

        self._run(request, run, "Shipment booked and the order marked as shipped.")
        return self._back(object_id)

    def _document(self, object_id, packing_slip):
        order = Order.objects.prefetch_related("items").get(pk=object_id)
        content, content_type, ext = render_invoice(order, packing_slip=packing_slip)
        name = "packing-slip" if packing_slip else "invoice"
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="{name}-{order.number}.{ext}"'
        return response

    @action(description="Invoice", url_path="invoice", icon="receipt")
    def invoice(self, request, object_id):
        return self._document(object_id, False)

    @action(description="Packing slip", url_path="packing-slip", icon="inventory")
    def packing_slip(self, request, object_id):
        return self._document(object_id, True)

    @action(description="Refund in full", url_path="refund", icon="undo")
    def refund_one(self, request, object_id):
        order = Order.objects.get(pk=object_id)
        self._run(request, lambda: refund_order(order, user=request.user), "Refund issued and the customer notified.")
        return self._back(object_id)

    @action(description="Cancel order", url_path="cancel", icon="cancel")
    def cancel_one(self, request, object_id):
        order = Order.objects.get(pk=object_id)
        self._run(
            request, lambda: services.cancel_order(order, note="Cancelled by the store.", user=request.user),
            "Order cancelled and stock returned. Refund separately if it was prepaid.",
        )
        return self._back(object_id)
