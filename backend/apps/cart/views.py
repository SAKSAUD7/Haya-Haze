from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import CommerceError
from apps.inventory.tasks import release_lapsed_holds_inline
from apps.promotions.models import Coupon, GiftCard

from . import services
from .pricing import Totals, calculate, validate_coupon
from .serializers import (
    AddItemSerializer,
    CartSerializer,
    CodeSerializer,
    UpdateCartSerializer,
    UpdateItemSerializer,
    cart_payload,
)

QUOTE_PARAMS = [
    OpenApiParameter("shipping_method", str, description="standard or express"),
    OpenApiParameter("payment_method", str, description="razorpay, cod or stripe"),
]


class CartMixin:
    def respond(self, request, cart, status=200, notice: str = ""):
        if cart is None:
            totals = Totals()
        else:
            totals = calculate(
                cart, shipping_method=request.query_params.get("shipping_method", "standard"),
                payment_method=request.query_params.get("payment_method", ""), user=request.user,
            )
        data = cart_payload(cart, totals)
        if notice:
            data["issues"] = [notice, *data["issues"]]
        response = Response(data, status=status)
        services.set_cart_cookie(response, cart)
        return response


class CartView(CartMixin, APIView):
    @extend_schema(parameters=QUOTE_PARAMS, responses=CartSerializer)
    def get(self, request):
        """The current bag with server-calculated totals."""
        return self.respond(request, services.get_cart(request))

    @extend_schema(request=UpdateCartSerializer, responses=CartSerializer)
    def patch(self, request):
        ser = UpdateCartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = services.get_cart(request, create=True)
        for field, value in ser.validated_data.items():
            setattr(cart, field, value)
        cart.save()
        return self.respond(request, cart)


class CartItemsView(CartMixin, APIView):
    @extend_schema(request=AddItemSerializer, responses=CartSerializer)
    def post(self, request):
        ser = AddItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = services.get_cart(request, create=True)
        release_lapsed_holds_inline()
        notice = services.add_item(cart, **ser.validated_data)
        cart.save(update_fields=["updated_at"])
        return self.respond(request, cart, status=201, notice=notice)


class CartItemView(CartMixin, APIView):
    @extend_schema(request=UpdateItemSerializer, responses=CartSerializer)
    def patch(self, request, item_id: int):
        ser = UpdateItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = services.get_cart(request, create=True)
        notice = services.update_item(cart, item_id, **ser.validated_data)
        return self.respond(request, cart, notice=notice)

    @extend_schema(responses=CartSerializer)
    def delete(self, request, item_id: int):
        cart = services.get_cart(request)
        if cart:
            cart.items.filter(pk=item_id).delete()
        return self.respond(request, cart)


class CartCouponView(CartMixin, APIView):
    throttle_scope = "forms"

    @extend_schema(request=CodeSerializer, responses=CartSerializer)
    def post(self, request):
        ser = CodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = services.get_cart(request, create=True)
        coupon = Coupon.objects.filter(code__iexact=ser.validated_data["code"].strip()).first()
        if coupon is None:
            raise CommerceError("We could not find that code.", code="coupon_invalid")
        cart.coupon = None
        totals = calculate(cart, user=request.user)
        validate_coupon(coupon, totals.lines, totals.subtotal, user=request.user, email=cart.email)
        cart.coupon = coupon
        cart.save(update_fields=["coupon", "updated_at"])
        return self.respond(request, cart)

    @extend_schema(responses=CartSerializer)
    def delete(self, request):
        cart = services.get_cart(request)
        if cart:
            cart.coupon = None
            cart.save(update_fields=["coupon", "updated_at"])
        return self.respond(request, cart)


class CartGiftCardView(CartMixin, APIView):
    throttle_scope = "forms"

    @extend_schema(request=CodeSerializer, responses=CartSerializer)
    def post(self, request):
        ser = CodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = services.get_cart(request, create=True)
        card = GiftCard.objects.filter(code__iexact=ser.validated_data["code"].strip()).first()
        if card is None or not card.is_usable():
            raise CommerceError("This gift card is not valid or has no balance left.", code="gift_card_invalid")
        cart.gift_card = card
        cart.save(update_fields=["gift_card", "updated_at"])
        return self.respond(request, cart)

    @extend_schema(responses=CartSerializer)
    def delete(self, request):
        cart = services.get_cart(request)
        if cart:
            cart.gift_card = None
            cart.save(update_fields=["gift_card", "updated_at"])
        return self.respond(request, cart)
