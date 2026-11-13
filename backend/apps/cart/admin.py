from datetime import timedelta

from django.conf import settings
from django.contrib import admin
from django.db.models import Count
from django.utils import timezone
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import action, display

from apps.notifications.service import send_email

from .models import Cart, CartItem
from .pricing import calculate


class CartItemInline(TabularInline):
    model = CartItem
    extra = 0
    fields = ["variant", "quantity", "saved_for_later"]
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class AbandonedFilter(admin.SimpleListFilter):
    title = "state"
    parameter_name = "state"

    def lookups(self, request, model_admin):
        return [("abandoned", "Abandoned (reachable)"), ("recovered", "Recovered"), ("emailed", "Reminder sent")]

    def queryset(self, request, queryset):
        cutoff = timezone.now() - timedelta(hours=settings.ABANDONED_CART_HOURS)
        if self.value() == "abandoned":
            return queryset.filter(updated_at__lt=cutoff, recovered_at__isnull=True).exclude(email="", user__isnull=True)
        if self.value() == "recovered":
            return queryset.filter(recovered_at__isnull=False)
        if self.value() == "emailed":
            return queryset.filter(recovery_email_sent_at__isnull=False)
        return queryset


@admin.register(Cart)
class CartAdmin(ModelAdmin):
    """Marketing → Abandoned carts. Only carts that still hold items are listed."""

    list_display = ["who", "items_count", "value", "updated_at", "state"]
    list_filter = [AbandonedFilter]
    search_fields = ["email", "user__email"]
    list_select_related = ["user", "coupon"]
    inlines = [CartItemInline]
    readonly_fields = ["token", "user", "email", "coupon", "gift_card", "recovery_email_sent_at", "recovered_at", "updated_at"]
    fields = readonly_fields
    actions = ["send_reminder"]
    list_per_page = 40
    show_full_result_count = False

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_n=Count("items")).filter(_n__gt=0)

    def has_add_permission(self, request):
        return False

    @display(description="Shopper")
    def who(self, obj):
        return (obj.user.email if obj.user_id else obj.email) or "Guest (no email yet)"

    @display(description="Items", ordering="_n")
    def items_count(self, obj):
        return obj._n

    @display(description="Value")
    def value(self, obj):
        return f"₹{calculate(obj).subtotal:,.0f}"

    @display(description="State", label={"Recovered": "success", "Reminder sent": "info", "Abandoned": "warning", "Active": "success"})
    def state(self, obj):
        if obj.recovered_at:
            return "Recovered"
        if obj.recovery_email_sent_at:
            return "Reminder sent"
        idle = timezone.now() - obj.updated_at > timedelta(hours=settings.ABANDONED_CART_HOURS)
        return "Abandoned" if idle else "Active"

    @action(description="Send recovery email now")
    def send_reminder(self, request, queryset):
        sent = 0
        for cart in queryset:
            email = cart.user.email if cart.user_id else cart.email
            items = cart.items.filter(saved_for_later=False).select_related("variant__product")[:4]
            if email and items and send_email("abandoned_cart", email, "You left something beautiful behind", {"items": items, "cart": cart}):
                Cart.objects.filter(pk=cart.pk).update(recovery_email_sent_at=timezone.now())
                sent += 1
        self.message_user(request, f"{sent} reminder(s) sent. Carts without an email were skipped.")
