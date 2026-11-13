import hmac

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .providers.shiprocket import map_status


class PincodeSerializer(serializers.Serializer):
    pincode = serializers.CharField()
    serviceable = serializers.BooleanField()
    cod_available = serializers.BooleanField()
    city = serializers.CharField(allow_blank=True)
    state = serializers.CharField(allow_blank=True)
    standard_days = serializers.CharField()
    express_days = serializers.CharField()
    standard_eta = serializers.CharField(allow_blank=True)
    express_eta = serializers.CharField(allow_blank=True)
    message = serializers.CharField()


class PincodeView(APIView):
    @extend_schema(responses=PincodeSerializer)
    def get(self, request, pincode: str):
        """Delivery estimate, COD availability and city/state for a pincode."""
        return Response(services.check_pincode(pincode))


class ShiprocketWebhookView(APIView):
    authentication_classes: list = []
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def post(self, request):
        expected = settings.SHIPROCKET_WEBHOOK_TOKEN
        given = request.headers.get("X-Api-Key", "")
        if not expected or not hmac.compare_digest(expected, given):
            raise PermissionDenied("Invalid token.")
        awb = str(request.data.get("awb", ""))
        status = map_status(request.data.get("current_status", ""))
        updated = bool(awb and status) and services.apply_tracking_update(awb, status)
        return Response({"ok": True, "updated": updated})
