from django.core import signing
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cart import services as cart_services
from apps.core.exceptions import CommerceError
from apps.inventory.tasks import release_lapsed_holds_inline
from apps.payments import services as payment_services
from apps.promotions.models import Subscriber

from . import services
from .invoice import render_invoice
from .models import Order
from .serializers import (
    OrderListSerializer,
    OrderSerializer,
    PlaceOrderResponseSerializer,
    PlaceOrderSerializer,
    TrackOrderSerializer,
)

TOKEN_SALT = "order-access"
TOKEN_MAX_AGE = 60 * 60 * 24 * 30


def order_token(order: Order) -> str:
    return signing.dumps(order.number, salt=TOKEN_SALT)


def _queryset():
    return Order.objects.prefetch_related("items", "events", "shipments")


def get_order_for(request, number: str) -> Order:
    """An order is visible to its owner, or to anyone holding its signed access token
    (given to guests at checkout and by the track-order form)."""
    order = _queryset().filter(number=number.upper()).first()
    if order is None:
        raise NotFound("Order not found.")
    if request.user.is_authenticated and (order.user_id == request.user.id or order.email == request.user.email):
        return order
    token = request.query_params.get("token") or request.headers.get("X-Order-Token", "")
    try:
        if token and signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE) == order.number:
            return order
    except signing.BadSignature:
        pass
    raise NotFound("Order not found.")


class PlaceOrderView(APIView):
    throttle_scope = "checkout"

    @extend_schema(request=PlaceOrderSerializer, responses=PlaceOrderResponseSerializer)
    def post(self, request):
        """Create the order. Prices, stock and coupons are all re-checked here; nothing
        the client sends is trusted beyond the address and the chosen methods."""
        ser = PlaceOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        release_lapsed_holds_inline()
        existing = Order.objects.filter(idempotency_key=data["idempotency_key"]).first()
        if existing:
            order = existing
        else:
            cart = cart_services.get_cart(request)
            if cart is None:
                raise CommerceError("Your bag is empty.", code="empty_cart")
            order, _ = services.place_order(cart=cart, user=request.user, data=data, idempotency_key=data["idempotency_key"])
            if data["subscribe"]:
                Subscriber.objects.get_or_create(email=order.email, defaults={"source": "checkout"})
        payment = None
        if order.status == Order.Status.PENDING:
            try:
                payment = payment_services.start_payment(order)
            except CommerceError:
                services.cancel_order(order, note="Payment could not be started.", notify=False)
                raise
        order = _queryset().get(pk=order.pk)
        return Response({"order": OrderSerializer(order).data, "payment": payment, "access_token": order_token(order)}, status=201)


class OrderListView(generics.ListAPIView):
    serializer_class = OrderListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Order.objects.none()
        return (
            Order.objects.filter(user=self.request.user).exclude(status=Order.Status.PENDING).prefetch_related("items")
        )


TOKEN_PARAM = [OpenApiParameter("token", str, description="Guest access token")]


class OrderDetailView(APIView):
    @extend_schema(parameters=TOKEN_PARAM, responses=OrderSerializer)
    def get(self, request, number: str):
        return Response(OrderSerializer(get_order_for(request, number)).data)


class OrderCancelView(APIView):
    @extend_schema(parameters=TOKEN_PARAM, request=None, responses=OrderSerializer)
    def post(self, request, number: str):
        order = get_order_for(request, number)
        services.cancel_order(order, note="Cancelled at your request.")
        if order.payment_status == Order.PaymentStatus.PAID:
            payment_services.refund_order(order, reason="Order cancelled by customer.")
        return Response(OrderSerializer(_queryset().get(pk=order.pk)).data)


class OrderReorderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={200: {"type": "object", "properties": {"added": {"type": "integer"}, "skipped": {"type": "integer"}}}})
    def post(self, request, number: str):
        order = get_order_for(request, number)
        cart = cart_services.get_cart(request, create=True)
        added = skipped = 0
        for item in order.items.all():
            try:
                cart_services.add_item(cart, item.variant_id or 0, item.quantity)
                added += 1
            except CommerceError:
                skipped += 1
        return Response({"added": added, "skipped": skipped})


class OrderInvoiceView(APIView):
    @extend_schema(parameters=TOKEN_PARAM, responses={(200, "application/pdf"): bytes})
    def get(self, request, number: str):
        order = get_order_for(request, number)
        if order.status in (Order.Status.PENDING, Order.Status.CANCELLED):
            raise NotFound("An invoice is available once the order is confirmed.")
        content, content_type, ext = render_invoice(order)
        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'inline; filename="HayaHaze-{order.number}.{ext}"'
        return response


class TrackOrderView(APIView):
    throttle_scope = "forms"

    @extend_schema(request=TrackOrderSerializer, responses=PlaceOrderResponseSerializer)
    def post(self, request):
        """Guests look up an order with its number and the email used at checkout."""
        ser = TrackOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        order = (
            _queryset()
            .filter(number=ser.validated_data["number"].strip().upper(), email__iexact=ser.validated_data["email"])
            .first()
        )
        if order is None:
            raise NotFound("We could not find an order with that number and email.")
        return Response({"order": OrderSerializer(order).data, "payment": None, "access_token": order_token(order)})
