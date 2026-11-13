from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Count, Q, Sum
from import_export import resources
from import_export.admin import ExportActionModelAdmin
from unfold.admin import ModelAdmin, TabularInline
from unfold.contrib.import_export.forms import ExportForm
from unfold.decorators import display
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import Address, User


class CustomerCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ("email",)


class CustomerChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


class CustomerResource(resources.ModelResource):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "accepts_marketing", "tags", "date_joined"]


class AddressInline(TabularInline):
    model = Address
    extra = 0
    fields = ["full_name", "phone", "line1", "city", "state", "pincode", "is_default"]


@admin.register(User)
class CustomerAdmin(BaseUserAdmin, ExportActionModelAdmin, ModelAdmin):
    form = CustomerChangeForm
    add_form = CustomerCreationForm
    change_password_form = AdminPasswordChangeForm
    export_form_class = ExportForm
    resource_classes = [CustomerResource]

    ordering = ["-date_joined"]
    list_display = ["email", "name", "phone", "order_count", "lifetime_value", "tags", "is_staff", "date_joined"]
    list_filter = ["is_staff", "is_active", "accepts_marketing", "groups", "date_joined"]
    search_fields = ["email", "first_name", "last_name", "phone", "tags"]
    list_per_page = 50
    show_full_result_count = False
    inlines = [AddressInline]
    readonly_fields = ["last_login", "date_joined", "order_count", "lifetime_value"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Customer", {"fields": ["first_name", "last_name", "phone", "accepts_marketing", "tags", "notes"]}),
        ("Activity", {"fields": ["order_count", "lifetime_value", "last_login", "date_joined"]}),
        ("Staff access", {"classes": ["collapse"], "fields": ["is_active", "is_staff", "is_superuser", "groups", "user_permissions"]}),
    ]
    add_fieldsets = [(None, {"classes": ["wide"], "fields": ["email", "password1", "password2"]})]

    def get_queryset(self, request):
        paid = ~Q(orders__status__in=["pending", "cancelled"])
        return super().get_queryset(request).annotate(
            _orders=Count("orders", filter=paid, distinct=True),
            _ltv=Sum("orders__total", filter=paid),
        )

    @display(description="Name", ordering="first_name")
    def name(self, obj):
        return obj.get_full_name() or "—"

    @display(description="Orders", ordering="_orders")
    def order_count(self, obj):
        return getattr(obj, "_orders", 0)

    @display(description="Lifetime value", ordering="_ltv")
    def lifetime_value(self, obj):
        return f"₹{getattr(obj, '_ltv', None) or 0:,.0f}"
