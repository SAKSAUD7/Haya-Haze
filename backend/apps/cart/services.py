import uuid

from django.conf import settings
from django.db import transaction

from apps.catalog.models import Variant
from apps.core.exceptions import CommerceError

from .models import Cart, CartItem


def get_cart(request, create: bool = False) -> Cart | None:
    """The signed-in shopper's cart, or the guest cart named by the ``hh_cart`` cookie."""
    user = request.user if request.user.is_authenticated else None
    if user:
        cart = Cart.objects.filter(user=user).first()
        if cart is None and create:
            cart, _ = Cart.objects.get_or_create(user=user)
        return cart
    token = request.COOKIES.get(settings.CART_COOKIE_NAME, "")
    cart = None
    try:
        cart = Cart.objects.filter(token=uuid.UUID(token), user__isnull=True).first() if token else None
    except ValueError:
        cart = None
    if cart is None and create:
        cart = Cart.objects.create()
    return cart


def set_cart_cookie(response, cart: Cart | None) -> None:
    if cart is not None and cart.user_id is None:
        response.set_cookie(
            settings.CART_COOKIE_NAME, str(cart.token), max_age=settings.CART_COOKIE_AGE, httponly=True,
            samesite="Lax", secure=not settings.DEBUG,
        )


@transaction.atomic
def add_item(cart: Cart, variant_id: int, quantity: int = 1) -> str:
    """Add to the bag. Returns a notice when the quantity had to be capped to stock."""
    variant = Variant.objects.select_related("product").filter(pk=variant_id, is_active=True).first()
    if variant is None or not variant.product.is_live:
        raise CommerceError("This item is no longer available.", code="unavailable")
    item, _ = CartItem.objects.select_for_update().get_or_create(cart=cart, variant=variant, defaults={"quantity": 0})
    wanted = (0 if item.saved_for_later else item.quantity) + quantity
    return _set_quantity(item, variant, wanted)


def _set_quantity(item: CartItem, variant: Variant, wanted: int) -> str:
    """Set the quantity, capped to what is available. A cap is reported, not raised:
    raising here would roll back the surrounding transaction and lose the capped item."""
    limit = min(variant.available, CartItem.MAX_QUANTITY)
    if limit <= 0:
        if item.quantity == 0:
            item.delete()
        raise CommerceError(f"{variant} is sold out.", code="insufficient_stock")
    if wanted > limit:
        item.quantity, item.saved_for_later = limit, False
        item.save()
        return f"Only {limit} available. We have added {limit} to your bag."
    item.quantity, item.saved_for_later = wanted, False
    item.save()
    return ""


@transaction.atomic
def update_item(cart: Cart, item_id: int, *, quantity=None, saved_for_later=None, variant_id=None) -> str:
    item = CartItem.objects.select_for_update().select_related("variant__product").filter(cart=cart, pk=item_id).first()
    if item is None:
        raise CommerceError("That item is no longer in your bag.", code="not_found")
    if variant_id and variant_id != item.variant_id:
        new = Variant.objects.filter(pk=variant_id, product_id=item.variant.product_id, is_active=True).first()
        if new is None:
            raise CommerceError("That option is not available.", code="unavailable")
        clash = CartItem.objects.filter(cart=cart, variant=new).exclude(pk=item.pk).first()
        if clash:
            item.quantity += clash.quantity
            clash.delete()
        item.variant = new
        item.save()
    if saved_for_later is not None:
        item.saved_for_later = saved_for_later
        item.save(update_fields=["saved_for_later", "updated_at"])
    notice = ""
    if quantity is not None:
        if quantity <= 0:
            item.delete()
        else:
            notice = _set_quantity(item, item.variant, quantity)
    cart.save(update_fields=["updated_at"])
    return notice


@transaction.atomic
def merge_guest_cart(request, user) -> None:
    """On login, fold the guest cart into the account's cart."""
    token = request.COOKIES.get(settings.CART_COOKIE_NAME, "")
    try:
        guest = Cart.objects.filter(token=uuid.UUID(token), user__isnull=True).first() if token else None
    except ValueError:
        guest = None
    if guest is None:
        return
    cart, created = Cart.objects.get_or_create(user=user)
    for item in guest.items.select_related("variant"):
        existing = cart.items.filter(variant=item.variant).first()
        if existing:
            existing.quantity = min(existing.quantity + item.quantity, CartItem.MAX_QUANTITY)
            existing.saved_for_later = existing.saved_for_later and item.saved_for_later
            existing.save()
        else:
            item.cart = cart
            item.save(update_fields=["cart"])
    if guest.coupon_id and not cart.coupon_id:
        cart.coupon = guest.coupon
    cart.gift_wrap = cart.gift_wrap or guest.gift_wrap
    cart.gift_note = cart.gift_note or guest.gift_note
    cart.save()
    guest.delete()
