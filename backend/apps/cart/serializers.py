from rest_framework import serializers

from apps.catalog.models import Product
from apps.catalog.serializers import ProductCardSerializer
from apps.core.utils import media_url

from .pricing import Totals

MONEY = {"max_digits": 10, "decimal_places": 2}


class CartLineSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    variant_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    slug = serializers.CharField()
    name = serializers.CharField()
    variant_label = serializers.CharField()
    color_hex = serializers.CharField()
    image = serializers.CharField(allow_null=True)
    collection = serializers.CharField()
    quantity = serializers.IntegerField()
    max_quantity = serializers.IntegerField()
    unit_price = serializers.DecimalField(**MONEY)
    compare_at_price = serializers.DecimalField(**MONEY, allow_null=True)
    line_total = serializers.DecimalField(**MONEY)
    discount = serializers.DecimalField(**MONEY)


class CartSerializer(serializers.Serializer):
    items = CartLineSerializer(many=True)
    saved = CartLineSerializer(many=True)
    upsell = ProductCardSerializer(many=True)
    item_count = serializers.IntegerField()
    subtotal = serializers.DecimalField(**MONEY)
    discount = serializers.DecimalField(**MONEY)
    coupon_code = serializers.CharField()
    coupon_message = serializers.CharField()
    shipping_method = serializers.CharField()
    shipping = serializers.DecimalField(**MONEY)
    shipping_free = serializers.BooleanField()
    free_shipping_threshold = serializers.DecimalField(**MONEY)
    free_shipping_remaining = serializers.DecimalField(**MONEY)
    cod_fee = serializers.DecimalField(**MONEY)
    cod_available = serializers.BooleanField()
    cod_unavailable_reason = serializers.CharField()
    gift_wrap = serializers.BooleanField()
    gift_wrap_fee = serializers.DecimalField(**MONEY)
    gift_wrap_price = serializers.DecimalField(**MONEY)
    gift_note = serializers.CharField()
    order_note = serializers.CharField()
    tax_total = serializers.DecimalField(**MONEY)
    tax_included = serializers.BooleanField()
    gift_card_code = serializers.CharField()
    gift_card_amount = serializers.DecimalField(**MONEY)
    total = serializers.DecimalField(**MONEY)
    issues = serializers.ListField(child=serializers.CharField())


class AddItemSerializer(serializers.Serializer):
    variant_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=10, default=1)


class UpdateItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0, max_value=10, required=False)
    saved_for_later = serializers.BooleanField(required=False)
    variant_id = serializers.IntegerField(required=False)


class UpdateCartSerializer(serializers.Serializer):
    gift_wrap = serializers.BooleanField(required=False)
    gift_note = serializers.CharField(max_length=300, allow_blank=True, required=False)
    order_note = serializers.CharField(max_length=500, allow_blank=True, required=False)
    email = serializers.EmailField(required=False)


class CodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=30)


def _line(variant, item_id, quantity, unit, compare, total, discount) -> dict:
    product = variant.product
    media = next(
        (m for m in product.media.all() if m.image and (not m.color_name or m.color_name == variant.color_name)), None
    )
    return {
        "id": item_id, "variant_id": variant.id, "product_id": product.id, "slug": product.slug,
        "name": product.name, "variant_label": variant.label, "color_hex": variant.color_hex,
        "image": media_url(media.image) if media else None,
        "collection": product.primary_collection.name if product.primary_collection_id else "",
        "quantity": quantity, "max_quantity": min(variant.available, 10), "unit_price": unit,
        "compare_at_price": compare, "line_total": total, "discount": discount,
    }


def cart_payload(cart, totals: Totals) -> dict:
    """Shape a cart + its computed totals for the API."""
    from apps.core.models import SiteSettings

    cfg = SiteSettings.load()
    items = [
        _line(line.variant, line.item_id, line.quantity, line.unit_price, line.compare_at_price, line.line_total, line.discount)
        for line in totals.lines
    ]
    saved, upsell = [], []
    if cart is not None:
        for item in cart.items.filter(saved_for_later=True).select_related("variant__product__primary_collection"):
            v = item.variant
            saved.append(_line(v, item.id, item.quantity, v.effective_price, v.effective_compare_at, v.effective_price * item.quantity, 0))
        in_bag = [line.variant.product_id for line in totals.lines]
        if in_bag:
            # "Complete the look": hand-picked related products first, then bestsellers.
            related = Product.objects.live().for_listing().filter(pk__in=Product.related_products.through.objects.filter(
                from_product_id__in=in_bag).values("to_product_id")).exclude(pk__in=in_bag)[:3]
            upsell = list(related)
            if len(upsell) < 3:
                more = (
                    Product.objects.live().for_listing().exclude(pk__in=in_bag + [p.pk for p in upsell])
                    .order_by("price", "-sales_count")[: 3 - len(upsell)]
                )
                upsell += list(more)
    data = {
        "items": items, "saved": saved, "upsell": upsell, "item_count": totals.item_count,
        "gift_wrap": bool(cart and cart.gift_wrap), "gift_wrap_price": cfg.gift_wrap_fee,
        "gift_note": cart.gift_note if cart else "", "order_note": cart.order_note if cart else "",
    }
    for key in (
        "subtotal", "discount", "coupon_code", "coupon_message", "shipping_method", "shipping", "shipping_free",
        "free_shipping_threshold", "free_shipping_remaining", "cod_fee", "cod_available", "cod_unavailable_reason",
        "gift_wrap_fee", "tax_total", "tax_included", "gift_card_code", "gift_card_amount", "total", "issues",
    ):
        data[key] = getattr(totals, key)
    return CartSerializer(data).data
