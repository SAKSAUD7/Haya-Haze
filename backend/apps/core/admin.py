from django.conf import settings
from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.models import Group
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin
from unfold.decorators import action, display

from .models import Announcement, ContactMessage, SiteSettings

admin.site.unregister(Group)


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass


def _masked(value: str) -> str:
    if not value:
        return "Not set"
    return f"{value[:4]}…{value[-3:]}" if len(value) > 8 else "Set"


@admin.register(SiteSettings)
class SiteSettingsAdmin(SimpleHistoryAdmin, ModelAdmin):
    readonly_fields = ["integrations"]
    fieldsets = [
        ("Store", {"classes": ["tab"], "fields": [
            "store_name", "tagline", "logo_light", "logo_dark", "contact_email", "contact_phone", "address", "gstin",
        ]}),
        ("Social & WhatsApp", {"classes": ["tab"], "fields": [
            "whatsapp_number", "whatsapp_message", "instagram_url", "tiktok_url", "pinterest_url",
        ]}),
        ("Shipping & COD", {"classes": ["tab"], "fields": [
            "free_shipping_threshold", "standard_shipping_rate", "express_shipping_rate", "standard_delivery_days",
            "express_delivery_days", "ship_to_unlisted_pincodes", "cod_enabled", "cod_fee", "cod_min_order",
            "cod_max_order", "gift_wrap_fee",
        ]}),
        ("Tax", {"classes": ["tab"], "fields": ["prices_include_gst", "default_gst_rate", "default_hsn_code"]}),
        ("Home page 3D", {"classes": ["tab"], "fields": [
            "hero_headline", "hero_subtext", "wardrobe_enabled", "wardrobe_title", "wardrobe_subtitle",
            "wardrobe_wood_tone", "wardrobe_light_warmth",
        ]}),
        ("Marketing & SEO", {"classes": ["tab"], "fields": [
            "popup_enabled", "popup_title", "popup_text", "popup_coupon_code", "ga4_measurement_id", "meta_pixel_id",
            "seo_title", "seo_description",
        ]}),
        ("Integrations", {"classes": ["tab"], "fields": ["integrations"]}),
    ]

    @display(description="Keys (set in the server environment)")
    def integrations(self, obj):
        rows = [
            ("Razorpay key", _masked(settings.RAZORPAY_KEY_ID)),
            ("Razorpay webhook secret", _masked(settings.RAZORPAY_WEBHOOK_SECRET)),
            ("Stripe secret key", _masked(settings.STRIPE_SECRET_KEY)),
            ("Shiprocket account", _masked(settings.SHIPROCKET_EMAIL)),
            ("Google sign-in client", _masked(settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"])),
            ("Sandbox payments", "ON (development only)" if settings.PAYMENTS_SANDBOX else "Off"),
        ]
        body = "".join(f"<tr><td style='padding:4px 24px 4px 0'>{k}</td><td><code>{v}</code></td></tr>" for k, v in rows)
        return format_html("<table>{}</table>", format_html(body))

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = SiteSettings.load()
        return redirect(reverse("admin:core_sitesettings_change", args=[obj.pk]))


@admin.register(Announcement)
class AnnouncementAdmin(ModelAdmin):
    list_display = ["text", "link", "order", "is_active"]
    list_editable = ["order", "is_active"]


@admin.register(ContactMessage)
class ContactMessageAdmin(ModelAdmin):
    list_display = ["name", "email", "subject", "created_at", "resolved"]
    list_filter = ["is_resolved", "created_at"]
    search_fields = ["name", "email", "subject", "message"]
    readonly_fields = ["name", "email", "phone", "subject", "message", "created_at"]
    fields = readonly_fields + ["is_resolved", "admin_note"]
    actions = ["mark_resolved"]

    @display(description="Status", label={"Resolved": "success", "Open": "warning"})
    def resolved(self, obj):
        return "Resolved" if obj.is_resolved else "Open"

    @action(description="Mark selected as resolved")
    def mark_resolved(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_resolved=True)} message(s) resolved.")

    def has_add_permission(self, request):
        return False
