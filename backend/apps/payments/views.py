import json
import logging

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import CommerceError
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.orders.views import get_order_for

from . import services
from .providers import PROVIDERS
from .providers.razorpay_provider import RazorpayProvider
from .providers.stripe_provider import StripeProvider

log = logging.getLogger(__name__)


class PaymentMethodSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    sandbox = serializers.BooleanField()


class RazorpayVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class StripeVerifySerializer(serializers.Serializer):
    session_id = serializers.CharField()


class SandboxSerializer(serializers.Serializer):
    provider_order_id = serializers.CharField()
    outcome = serializers.ChoiceField(choices=["success", "failure"], default="success")


def _order_response(order: Order) -> Response:
    order = Order.objects.prefetch_related("items", "events", "shipments").get(pk=order.pk)
    return Response(OrderSerializer(order).data)


class PaymentMethodsView(APIView):
    @extend_schema(responses=PaymentMethodSerializer(many=True))
    def get(self, request):
        """Online payment methods that are configured. COD is governed by cart totals."""
        return Response([
            {"code": p.code, "label": p.label, "sandbox": bool(getattr(p, "sandbox", False))}
            for p in PROVIDERS.values() if p.is_configured()
        ])


class RetryPaymentView(APIView):
    throttle_scope = "checkout"

    @extend_schema(request=None, responses={200: {"type": "object", "additionalProperties": True}})
    def post(self, request, number: str):
        return Response(services.start_payment(get_order_for(request, number)))


class RazorpayVerifyView(APIView):
    throttle_scope = "checkout"

    @extend_schema(request=RazorpayVerifySerializer, responses=OrderSerializer)
    def post(self, request):
        """Client callback after Razorpay Checkout. The signature is verified server-side."""
        ser = RazorpayVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return _order_response(services.confirm_payment("razorpay", ser.validated_data))


class StripeVerifyView(APIView):
    throttle_scope = "checkout"

    @extend_schema(request=StripeVerifySerializer, responses=OrderSerializer)
    def post(self, request):
        ser = StripeVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return _order_response(services.confirm_payment("stripe", ser.validated_data))


class SandboxPayView(APIView):
    """Stands in for the Razorpay popup when no keys are configured in DEBUG.

    It produces a correctly signed confirmation and runs it through the same
    verification path as a real payment. Refused outright outside sandbox mode.
    """

    throttle_scope = "checkout"

    @extend_schema(request=SandboxSerializer, responses=OrderSerializer)
    def post(self, request):
        if not settings.PAYMENTS_SANDBOX:
            raise PermissionDenied("Sandbox payments are disabled.")
        ser = SandboxSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        provider_order_id = ser.validated_data["provider_order_id"]
        if ser.validated_data["outcome"] == "failure":
            services.fail("razorpay", provider_order_id, "Payment was declined (sandbox).")
            raise CommerceError("Payment failed. No money was taken.", code="payment_failed")
        payload = RazorpayProvider().sandbox_confirmation(provider_order_id)
        return _order_response(services.confirm_payment("razorpay", payload))


class RazorpayWebhookView(APIView):
    authentication_classes: list = []
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def post(self, request):
        signature = request.headers.get("X-Razorpay-Signature", "")
        if not RazorpayProvider.verify_webhook(request.body, signature):
            raise PermissionDenied("Invalid signature.")
        event = json.loads(request.body or b"{}")
        entity = (event.get("payload", {}).get("payment", {}) or {}).get("entity", {})
        order_id, payment_id = entity.get("order_id", ""), entity.get("id", "")
        try:
            if event.get("event") in ("payment.captured", "order.paid") and order_id:
                services.settle("razorpay", order_id, payment_id, method=entity.get("method", ""))
            elif event.get("event") == "payment.failed" and order_id:
                # A failed attempt is not final: the shopper can retry inside the popup,
                # so the order stays pending until its reservation expires.
                log.info("Razorpay payment failed for %s", order_id)
        except CommerceError as exc:
            log.warning("Razorpay webhook ignored: %s", exc)
        return Response({"ok": True})


class StripeWebhookView(APIView):
    authentication_classes: list = []
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def post(self, request):
        try:
            event = StripeProvider.parse_webhook(request.body, request.headers.get("Stripe-Signature", ""))
        except Exception:
            raise PermissionDenied("Invalid signature.")
        obj = event["data"]["object"]
        try:
            if event["type"] == "checkout.session.completed" and obj.get("payment_status") == "paid":
                services.settle("stripe", obj["id"], str(obj.get("payment_intent") or ""), method="card")
            elif event["type"] == "checkout.session.expired":
                services.fail("stripe", obj["id"], "Card payment was not completed.")
        except CommerceError as exc:
            log.warning("Stripe webhook ignored: %s", exc)
        except Order.DoesNotExist:
            raise NotFound()
        return Response({"ok": True})
