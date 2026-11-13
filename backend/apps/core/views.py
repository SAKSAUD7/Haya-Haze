from django.conf import settings
from drf_spectacular.utils import extend_schema, extend_schema_field
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers import DetailSerializer
from apps.core.utils import media_url
from apps.inventory.models import BackInStockRequest
from apps.notifications import tasks
from apps.promotions.models import Subscriber

from .models import Announcement, ContactMessage, SiteSettings


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ["text", "link"]


class SiteConfigSerializer(serializers.ModelSerializer):
    announcements = serializers.SerializerMethodField()
    logo_light = serializers.SerializerMethodField()
    logo_dark = serializers.SerializerMethodField()
    payments_sandbox = serializers.SerializerMethodField()
    google_client_id = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        fields = [
            "store_name", "tagline", "logo_light", "logo_dark", "contact_email", "contact_phone", "address",
            "whatsapp_number", "whatsapp_message", "instagram_url", "tiktok_url", "pinterest_url",
            "free_shipping_threshold", "standard_shipping_rate", "express_shipping_rate", "standard_delivery_days",
            "express_delivery_days", "cod_enabled", "cod_fee", "gift_wrap_fee", "prices_include_gst",
            "hero_headline", "hero_subtext", "wardrobe_enabled", "wardrobe_title", "wardrobe_subtitle",
            "wardrobe_wood_tone", "wardrobe_light_warmth", "popup_enabled", "popup_title", "popup_text",
            "popup_coupon_code", "ga4_measurement_id", "meta_pixel_id", "seo_title", "seo_description",
            "announcements", "payments_sandbox", "google_client_id",
        ]

    @extend_schema_field(AnnouncementSerializer(many=True))
    def get_announcements(self, obj) -> list[dict]:
        return AnnouncementSerializer(Announcement.objects.filter(is_active=True), many=True).data

    def get_logo_light(self, obj) -> str | None:
        return media_url(obj.logo_light)

    def get_logo_dark(self, obj) -> str | None:
        return media_url(obj.logo_dark)

    def get_payments_sandbox(self, obj) -> bool:
        return settings.PAYMENTS_SANDBOX

    def get_google_client_id(self, obj) -> str:
        return settings.SOCIALACCOUNT_PROVIDERS["google"]["APP"]["client_id"]


class SiteConfigView(APIView):
    @extend_schema(responses=SiteConfigSerializer)
    def get(self, request):
        """Public store configuration: contact details, shipping rules, announcements."""
        return Response(SiteConfigSerializer(SiteSettings.load()).data)


class SubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    source = serializers.CharField(max_length=30, required=False, default="footer")


class SubscribeResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    coupon_code = serializers.CharField(allow_blank=True)


class NewsletterView(APIView):
    throttle_scope = "forms"

    @extend_schema(request=SubscribeSerializer, responses=SubscribeResponseSerializer)
    def post(self, request):
        ser = SubscribeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].lower()
        Subscriber.objects.update_or_create(
            email=email, defaults={"is_active": True, "source": ser.validated_data["source"]}
        )
        cfg = SiteSettings.load()
        return Response({"detail": "You are on the list. Welcome to the family.", "coupon_code": cfg.popup_coupon_code})


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "email", "phone", "subject", "message"]


class ContactView(APIView):
    throttle_scope = "forms"

    @extend_schema(request=ContactSerializer, responses=DetailSerializer)
    def post(self, request):
        ser = ContactSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        msg = ser.save()
        tasks.send_contact_notification.delay(msg.pk)
        return Response({"detail": "Thank you. We will get back to you within one working day."}, status=201)


class BackInStockSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    email = serializers.EmailField()


class BackInStockView(APIView):
    throttle_scope = "forms"

    @extend_schema(request=BackInStockSerializer, responses=DetailSerializer)
    def post(self, request):
        from apps.catalog.models import Variant

        ser = BackInStockSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        variant = Variant.objects.filter(pk=ser.validated_data["variant_id"]).first()
        if variant is None:
            raise serializers.ValidationError({"variant_id": ["Unknown item."]})
        BackInStockRequest.objects.update_or_create(
            variant=variant, email=ser.validated_data["email"].lower(), defaults={"notified_at": None}
        )
        return Response({"detail": "We will email you the moment it is back."}, status=201)
