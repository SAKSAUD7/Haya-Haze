"""The pricing engine. Every total the shopper sees or pays is computed here, on the
server, from current catalogue prices. The client never sends amounts.
"""
from dataclasses import dataclass, field
from decimal import Decimal

from apps.core.exceptions import CommerceError
from apps.core.models import SiteSettings
from apps.core.utils import money
from apps.promotions.models import Coupon, CouponRedemption

ZERO = Decimal("0")


@dataclass
class Line:
    item_id: int
    variant: object
    quantity: int
    unit_price: Decimal
    compare_at_price: Decimal | None
    line_total: Decimal
    discount: Decimal = ZERO
    gst_rate: Decimal = ZERO
    tax_amount: Decimal = ZERO
    hsn_code: str = ""
    available: int = 0


@dataclass
class Totals:
    lines: list[Line] = field(default_factory=list)
    item_count: int = 0
    subtotal: Decimal = ZERO
    discount: Decimal = ZERO
    coupon_code: str = ""
    coupon_message: str = ""
    shipping_method: str = "standard"
    shipping: Decimal = ZERO
    shipping_free: bool = False
    free_shipping_threshold: Decimal = ZERO
    free_shipping_remaining: Decimal = ZERO
    cod_fee: Decimal = ZERO
    gift_wrap_fee: Decimal = ZERO
    tax_total: Decimal = ZERO
    tax_included: bool = True
    gift_card_code: str = ""
    gift_card_amount: Decimal = ZERO
    total: Decimal = ZERO
    cod_available: bool = True
    cod_unavailable_reason: str = ""
    issues: list[str] = field(default_factory=list)


def _eligible_lines(coupon: Coupon, lines: list[Line]) -> list[Line]:
    product_ids = set(coupon.products.values_list("id", flat=True))
    collection_ids = set(coupon.collections.values_list("id", flat=True))
    if not product_ids and not collection_ids:
        return lines
    out = []
    for line in lines:
        product = line.variant.product
        if product.id in product_ids:
            out.append(line)
        elif collection_ids and (
            product.primary_collection_id in collection_ids
            or product.collections.filter(id__in=collection_ids).exists()
        ):
            out.append(line)
    return out


def validate_coupon(coupon: Coupon, lines: list[Line], subtotal: Decimal, user=None, email: str = "") -> list[Line]:
    """Return the lines the coupon applies to, or raise CommerceError explaining why not."""
    if not coupon.is_live():
        raise CommerceError("This code has expired or is no longer active.", code="coupon_invalid")
    if subtotal < coupon.min_order_value:
        raise CommerceError(
            f"Add ₹{money(coupon.min_order_value - subtotal)} more to use {coupon.code}.", code="coupon_minimum"
        )
    identity = (user.email if user and user.is_authenticated else email or "").lower()
    if identity:
        if coupon.per_customer_limit is not None:
            used = CouponRedemption.objects.filter(coupon=coupon, email=identity).count()
            if used >= coupon.per_customer_limit:
                raise CommerceError("You have already used this code.", code="coupon_used")
        if coupon.first_order_only:
            from apps.orders.models import Order

            if Order.objects.filter(email__iexact=identity).exclude(status=Order.Status.CANCELLED).exists():
                raise CommerceError("This code is for first orders only.", code="coupon_first_order")
    eligible = _eligible_lines(coupon, lines)
    if not eligible:
        raise CommerceError("This code does not apply to the items in your bag.", code="coupon_scope")
    return eligible


def _coupon_discount(coupon: Coupon, eligible: list[Line]) -> Decimal:
    base = sum((line.line_total for line in eligible), ZERO)
    if coupon.kind == Coupon.Kind.PERCENT:
        amount = base * coupon.value / Decimal("100")
        if coupon.max_discount is not None:
            amount = min(amount, coupon.max_discount)
    elif coupon.kind == Coupon.Kind.FLAT:
        amount = min(coupon.value, base)
    elif coupon.kind == Coupon.Kind.BOGO:
        # Every second unit is free, cheapest first.
        units = sorted(p for line in eligible for p in [line.unit_price] * line.quantity)
        amount = sum(units[: len(units) // 2], ZERO)
    else:
        amount = ZERO
    return money(amount)


def _spread_discount(discount: Decimal, eligible: list[Line]) -> None:
    """Allocate an order-level discount across lines so GST is charged on what is paid."""
    base = sum((line.line_total for line in eligible), ZERO)
    if not base or not discount:
        return
    remaining = discount
    for i, line in enumerate(eligible):
        share = remaining if i == len(eligible) - 1 else money(discount * line.line_total / base)
        share = min(share, line.line_total)
        line.discount = share
        remaining -= share


def calculate(cart, *, shipping_method="standard", payment_method="", user=None, email="", strict=False) -> Totals:
    """Price a cart.

    ``strict`` is used at checkout: stock problems and invalid coupons raise instead of
    being reported in ``issues``.
    """
    cfg = SiteSettings.load()
    t = Totals(tax_included=cfg.prices_include_gst, free_shipping_threshold=cfg.free_shipping_threshold)
    if shipping_method not in ("standard", "express"):
        shipping_method = "standard"
    t.shipping_method = shipping_method

    items = (
        cart.items.filter(saved_for_later=False)
        .select_related("variant__product__primary_collection")
        .order_by("created_at")
    )
    for item in items:
        variant, product = item.variant, item.variant.product
        if not variant.is_active or not product.is_live:
            msg = f"{product.name} is no longer available."
            if strict:
                raise CommerceError(msg, code="unavailable")
            t.issues.append(msg)
            continue
        if variant.available < item.quantity:
            left = variant.available
            msg = f"Only {left} left of {variant}." if left else f"{variant} is sold out."
            if strict:
                raise CommerceError(msg, code="insufficient_stock")
            t.issues.append(msg)
        unit = variant.effective_price
        t.lines.append(
            Line(
                item_id=item.id, variant=variant, quantity=item.quantity, unit_price=unit,
                compare_at_price=variant.effective_compare_at, line_total=money(unit * item.quantity),
                gst_rate=product.gst_rate if product.gst_rate is not None else cfg.default_gst_rate,
                hsn_code=product.hsn_code or cfg.default_hsn_code, available=variant.available,
            )
        )
    t.item_count = sum(line.quantity for line in t.lines)
    t.subtotal = sum((line.line_total for line in t.lines), ZERO)
    if strict and not t.lines:
        raise CommerceError("Your bag is empty.", code="empty_cart")

    # Coupon: the one on the cart, otherwise the best auto-apply coupon.
    coupon, free_shipping = cart.coupon, False
    candidates = [coupon] if coupon else list(Coupon.objects.filter(auto_apply=True, is_active=True))
    best: tuple[Decimal, Coupon, list[Line]] | None = None
    for c in candidates:
        try:
            eligible = validate_coupon(c, t.lines, t.subtotal, user=user, email=email or cart.email)
        except CommerceError as exc:
            if c is coupon:
                if strict:
                    raise
                t.coupon_message = str(exc.detail)
            continue
        amount = _coupon_discount(c, eligible)
        if best is None or amount > best[0] or c is coupon:
            best = (amount, c, eligible)
    if best and t.lines:
        amount, c, eligible = best
        t.coupon_code, t.discount = c.code, amount
        free_shipping = c.kind == Coupon.Kind.FREE_SHIPPING
        _spread_discount(amount, eligible)

    # Shipping
    after_discount = t.subtotal - t.discount
    if t.lines:
        rate = cfg.express_shipping_rate if shipping_method == "express" else cfg.standard_shipping_rate
        qualifies = after_discount >= cfg.free_shipping_threshold
        if free_shipping or (qualifies and shipping_method == "standard"):
            t.shipping, t.shipping_free = ZERO, True
        elif qualifies and shipping_method == "express":
            # Express over the threshold pays only the difference.
            t.shipping = max(cfg.express_shipping_rate - cfg.standard_shipping_rate, ZERO)
        else:
            t.shipping = rate
        t.free_shipping_remaining = max(cfg.free_shipping_threshold - after_discount, ZERO)

    if cart.gift_wrap and t.lines:
        t.gift_wrap_fee = cfg.gift_wrap_fee

    # GST per line, on the discounted amount.
    for line in t.lines:
        taxable = line.line_total - line.discount
        if cfg.prices_include_gst:
            line.tax_amount = money(taxable - taxable / (1 + line.gst_rate / Decimal("100")))
        else:
            line.tax_amount = money(taxable * line.gst_rate / Decimal("100"))
    t.tax_total = sum((line.tax_amount for line in t.lines), ZERO)

    goods_total = after_discount + t.shipping + t.gift_wrap_fee
    if not cfg.prices_include_gst:
        goods_total += t.tax_total

    # COD rules
    if not cfg.cod_enabled:
        t.cod_available, t.cod_unavailable_reason = False, "Cash on Delivery is not available right now."
    elif goods_total < cfg.cod_min_order:
        t.cod_available = False
        t.cod_unavailable_reason = f"Cash on Delivery is available on orders above ₹{money(cfg.cod_min_order)}."
    elif goods_total > cfg.cod_max_order:
        t.cod_available = False
        t.cod_unavailable_reason = f"Cash on Delivery is available on orders up to ₹{money(cfg.cod_max_order)}."
    if payment_method == "cod":
        if not t.cod_available:
            if strict:
                raise CommerceError(t.cod_unavailable_reason, code="cod_unavailable")
        else:
            t.cod_fee = cfg.cod_fee
            goods_total += t.cod_fee

    # Gift card last: it is a payment instrument, not a discount.
    card = cart.gift_card
    if card and t.lines:
        if card.is_usable():
            t.gift_card_code = card.code
            t.gift_card_amount = min(card.balance, goods_total)
        elif strict:
            raise CommerceError("This gift card can no longer be used.", code="gift_card_invalid")
    t.total = money(goods_total - t.gift_card_amount)
    t.subtotal, t.discount, t.shipping = money(t.subtotal), money(t.discount), money(t.shipping)
    return t
