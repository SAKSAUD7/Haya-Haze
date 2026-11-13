"""Order lifecycle: placing, paying, moving through fulfilment, cancelling."""
import logging
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.cart.pricing import calculate
from apps.core.exceptions import CommerceError
from apps.core.utils import media_url
from apps.inventory import services as stock
from apps.inventory.models import StockMovement
from apps.promotions.models import Coupon, CouponRedemption, GiftCard

from .models import Order, OrderEvent, OrderItem

log = logging.getLogger(__name__)
ZERO = Decimal("0")


def _notify(task_name: str, *args) -> None:
    from apps.notifications import tasks

    transaction.on_commit(lambda: getattr(tasks, task_name).delay(*args))


def add_event(order, status="", note="", public=True, user=None) -> OrderEvent:
    return OrderEvent.objects.create(order=order, status=status, note=note[:300], is_public=public, created_by=user)


def place_order(*, cart, user, data: dict, idempotency_key: str) -> tuple[Order, bool]:
    """Create an order from the cart. Returns ``(order, created)``.

    Safe to retry: the same idempotency key always returns the same order.
    """
    existing = Order.objects.filter(idempotency_key=idempotency_key).first()
    if existing:
        return existing, False
    try:
        with transaction.atomic():
            return _create_order(cart, user, data, idempotency_key), True
    except IntegrityError:
        existing = Order.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing, False
        raise


def _create_order(cart, user, data, idempotency_key) -> Order:
    from apps.shipping.services import check_pincode

    address = data["address"]
    method = data["payment_method"]
    user = user if user and user.is_authenticated else None

    service = check_pincode(address["pincode"])
    if not service["serviceable"]:
        raise CommerceError("Sorry, we do not deliver to this pincode yet.", code="unserviceable")
    if method == Order.PaymentMethod.COD and not service["cod_available"]:
        raise CommerceError("Cash on Delivery is not available for this pincode.", code="cod_unavailable")

    totals = calculate(
        cart, shipping_method=data.get("shipping_method", "standard"), payment_method=method,
        user=user, email=data["email"], strict=True,
    )
    if totals.total == ZERO:
        method = Order.PaymentMethod.GIFT_CARD  # fully covered by a gift card

    order = Order.objects.create(
        idempotency_key=idempotency_key, user=user, email=data["email"].lower(), phone=data["phone"],
        payment_method=method, shipping_method=totals.shipping_method,
        ship_name=address["full_name"], ship_line1=address["line1"], ship_line2=address.get("line2", ""),
        ship_landmark=address.get("landmark", ""), ship_city=address["city"], ship_state=address["state"],
        ship_pincode=address["pincode"], ship_country=address.get("country", "IN"),
        subtotal=totals.subtotal, discount_total=totals.discount, shipping_total=totals.shipping,
        cod_fee=totals.cod_fee, gift_wrap_fee=totals.gift_wrap_fee, tax_total=totals.tax_total,
        tax_included=totals.tax_included, gift_card_amount=totals.gift_card_amount, total=totals.total,
        coupon_code=totals.coupon_code, gift_card_code=totals.gift_card_code,
        gift_wrap=cart.gift_wrap, gift_note=cart.gift_note, customer_note=cart.order_note,
    )
    items = []
    for line in totals.lines:
        variant, product = line.variant, line.variant.product
        media = next(
            (m for m in product.media.all() if m.image and (not m.color_name or m.color_name == variant.color_name)),
            None,
        )
        items.append(OrderItem(
            order=order, variant=variant, product=product, product_name=product.name, product_slug=product.slug,
            variant_label=variant.label, sku=variant.sku, image=(media_url(media.image) or "") if media else "",
            hsn_code=line.hsn_code, gst_rate=line.gst_rate, unit_price=line.unit_price, quantity=line.quantity,
            discount=line.discount, line_total=line.line_total, tax_amount=line.tax_amount,
            weight_grams=variant.weight_grams,
        ))
    OrderItem.objects.bulk_create(items)

    stock.reserve_for_order(order, [(line.variant.pk, line.quantity) for line in totals.lines])

    if totals.coupon_code:
        coupon = Coupon.objects.select_for_update().get(code=totals.coupon_code)
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            raise CommerceError("This code has just reached its limit.", code="coupon_invalid")
        Coupon.objects.filter(pk=coupon.pk).update(used_count=F("used_count") + 1)
        CouponRedemption.objects.create(coupon=coupon, order=order, email=order.email, amount=totals.discount)
    if totals.gift_card_amount:
        card = GiftCard.objects.select_for_update().get(code=totals.gift_card_code)
        if card.balance < totals.gift_card_amount:
            raise CommerceError("The gift card balance has changed. Please review your order.", code="gift_card_invalid")
        card.balance -= totals.gift_card_amount
        card.save(update_fields=["balance", "updated_at"])

    if user and data.get("save_address"):
        from apps.accounts.models import Address

        Address.objects.get_or_create(
            user=user, line1=address["line1"], pincode=address["pincode"],
            defaults={
                "full_name": address["full_name"], "phone": data["phone"], "line2": address.get("line2", ""),
                "landmark": address.get("landmark", ""), "city": address["city"], "state": address["state"],
                "is_default": not user.addresses.exists(),
            },
        )
    if cart.email != order.email:
        cart.email = order.email
        cart.save(update_fields=["email"])

    add_event(order, Order.Status.PENDING, "Order received.")
    if method in (Order.PaymentMethod.COD, Order.PaymentMethod.GIFT_CARD):
        confirm_order(order, cart=cart, paid=method == Order.PaymentMethod.GIFT_CARD)
    return order


def confirm_order(order, *, cart=None, paid: bool) -> None:
    """Stock is committed and the order enters fulfilment. Call inside a transaction."""
    stock.commit_order(order)
    order.status = Order.Status.CONFIRMED
    order.placed_at = timezone.now()
    if paid:
        order.payment_status = Order.PaymentStatus.PAID
    order.save(update_fields=["status", "placed_at", "payment_status", "updated_at"])
    note = "Payment received. Your order is confirmed." if paid else "Order confirmed. Pay with cash on delivery."
    add_event(order, Order.Status.CONFIRMED, note)

    from apps.catalog.models import Product

    for item in order.items.all():
        if item.product_id:
            Product.objects.filter(pk=item.product_id).update(sales_count=F("sales_count") + item.quantity)

    _clear_cart(order, cart)
    _notify("send_order_confirmation", order.pk)


def _clear_cart(order, cart=None) -> None:
    from apps.cart.models import Cart

    cart = cart or (
        Cart.objects.filter(user=order.user).first() if order.user_id else Cart.objects.filter(email=order.email).first()
    )
    if not cart:
        return
    cart.items.filter(saved_for_later=False).delete()
    cart.coupon = cart.gift_card = None
    cart.gift_wrap, cart.gift_note, cart.order_note = False, "", ""
    if cart.recovery_email_sent_at:
        cart.recovered_at = timezone.now()
    cart.save()


@transaction.atomic
def mark_paid(order_id: int) -> Order:
    """Idempotent: called by both the client-side verify and the provider webhook."""
    order = Order.objects.select_for_update().get(pk=order_id)
    if order.payment_status == Order.PaymentStatus.PAID:
        return order
    if order.status == Order.Status.CANCELLED:
        # Money arrived after the hold expired. Try to re-reserve; otherwise flag for refund.
        try:
            with transaction.atomic():
                stock.reserve_for_order(order, [(i.variant_id, i.quantity) for i in order.items.all() if i.variant_id])
        except CommerceError:
            order.payment_status = Order.PaymentStatus.PAID
            order.save(update_fields=["payment_status", "updated_at"])
            add_event(order, note="Payment arrived after the order expired and stock is gone. Refund required.", public=False)
            log.warning("Order %s paid after expiry; needs refund", order.number)
            return order
    confirm_order(order, paid=True)
    return order


@transaction.atomic
def mark_payment_failed(order_id: int, reason: str = "") -> None:
    order = Order.objects.select_for_update().get(pk=order_id)
    if order.status != Order.Status.PENDING or order.payment_status == Order.PaymentStatus.PAID:
        return
    order.payment_status = Order.PaymentStatus.FAILED
    order.save(update_fields=["payment_status", "updated_at"])
    cancel_order(order, note=reason or "Payment failed.", notify=False)


@transaction.atomic
def cancel_order(order, note="Order cancelled.", user=None, notify=True) -> None:
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.status == Order.Status.CANCELLED:
        return
    if not order.is_cancellable:
        raise CommerceError("This order has already shipped and can no longer be cancelled.", code="not_cancellable")
    stock.release_order(order)
    stock.restock_order(order, StockMovement.Reason.CANCELLATION)
    redemption = CouponRedemption.objects.filter(order=order).first()
    if redemption:
        Coupon.objects.filter(pk=redemption.coupon_id, used_count__gt=0).update(used_count=F("used_count") - 1)
        redemption.delete()
    if order.gift_card_amount:
        GiftCard.objects.filter(code=order.gift_card_code).update(balance=F("balance") + order.gift_card_amount)
    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status", "updated_at"])
    add_event(order, Order.Status.CANCELLED, note, user=user)
    if notify:
        _notify("send_order_status_email", order.pk, Order.Status.CANCELLED)


STATUS_NOTES = {
    Order.Status.CONFIRMED: "Your order is confirmed.",
    Order.Status.PACKED: "Your order has been packed with care.",
    Order.Status.SHIPPED: "Your order is on its way.",
    Order.Status.OUT_FOR_DELIVERY: "Out for delivery today.",
    Order.Status.DELIVERED: "Delivered. We hope you love it.",
    Order.Status.RETURNED: "Your return has been received.",
    Order.Status.REFUNDED: "Your refund has been processed.",
}


@transaction.atomic
def transition(order, new_status: str, user=None, note: str = "", notify=True) -> Order:
    """Move an order to ``new_status`` (admin workflow, shipping webhooks)."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    if new_status == order.status:
        return order
    if new_status == Order.Status.CANCELLED:
        cancel_order(order, note or "Order cancelled.", user=user, notify=notify)
        return order
    if order.status in (Order.Status.CANCELLED, Order.Status.REFUNDED):
        raise CommerceError(f"A {order.get_status_display().lower()} order cannot be changed.")
    if order.status == Order.Status.PENDING and new_status != Order.Status.CONFIRMED:
        raise CommerceError("Confirm the order before moving it forward.")
    if new_status == Order.Status.CONFIRMED and order.status == Order.Status.PENDING:
        confirm_order(order, paid=False)
        return order
    order.status = new_status
    fields = ["status", "updated_at"]
    if new_status == Order.Status.DELIVERED:
        order.delivered_at = timezone.now()
        fields.append("delivered_at")
        if order.payment_method == Order.PaymentMethod.COD:
            order.payment_status = Order.PaymentStatus.PAID
            fields.append("payment_status")
    if new_status == Order.Status.RETURNED:
        stock.restock_order(order, StockMovement.Reason.RETURN)
    if new_status == Order.Status.REFUNDED:
        order.payment_status = Order.PaymentStatus.REFUNDED
        fields.append("payment_status")
    order.save(update_fields=fields)
    add_event(order, new_status, note or STATUS_NOTES.get(new_status, ""), user=user)
    if notify:
        _notify("send_order_status_email", order.pk, new_status)
    return order


def next_status(order) -> str | None:
    flow = Order.FLOW
    if order.status in flow and flow.index(order.status) < len(flow) - 1:
        return flow[flow.index(order.status) + 1]
    return None
