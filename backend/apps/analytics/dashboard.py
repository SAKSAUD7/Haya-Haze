"""Admin dashboard figures. Computed with a handful of aggregate queries and cached
briefly, so the dashboard opens instantly even with a large order table."""
import json
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.db.models import Avg, Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

CACHE_KEY = "analytics:dashboard"
CACHE_SECONDS = 60
ZERO = Decimal("0")


def _money(value) -> str:
    return f"₹{(value or ZERO):,.0f}"


def _badge(key: str, compute) -> str | None:
    value = cache.get(key)
    if value is None:
        value = compute()
        cache.set(key, value, 30)
    return str(value) if value else None


def pending_orders_badge(request):
    from apps.orders.models import Order

    return _badge("badge:orders", lambda: Order.objects.filter(status=Order.Status.CONFIRMED).count())


def pending_returns_badge(request):
    from apps.returns.models import ReturnRequest

    return _badge("badge:returns", lambda: ReturnRequest.objects.filter(status=ReturnRequest.Status.REQUESTED).count())


def pending_reviews_badge(request):
    from apps.reviews.models import Review

    return _badge("badge:reviews", lambda: Review.objects.filter(status=Review.Status.PENDING).count())


def compute() -> dict:
    from apps.accounts.models import User
    from apps.cart.models import Cart
    from apps.catalog.models import Variant
    from apps.orders.models import Order, OrderItem
    from apps.returns.models import ReturnRequest
    from apps.reviews.models import Review

    now = timezone.localtime()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week, month, prev_month = today - timedelta(days=6), today - timedelta(days=29), today - timedelta(days=59)
    sales = Order.objects.exclude(status__in=[Order.Status.PENDING, Order.Status.CANCELLED])
    value = F("total") + F("gift_card_amount")

    def window(start, end=None):
        qs = sales.filter(created_at__gte=start)
        if end:
            qs = qs.filter(created_at__lt=end)
        return qs.aggregate(revenue=Sum(value), orders=Count("id"), aov=Avg(value))

    d, w, m, pm = window(today), window(week), window(month), window(prev_month, month)
    change = None
    if pm["revenue"]:
        change = round(((m["revenue"] or ZERO) - pm["revenue"]) / pm["revenue"] * 100)

    split = dict(sales.filter(created_at__gte=month).values_list("payment_method").annotate(n=Count("id")))
    cod, total_orders = split.get("cod", 0), sum(split.values()) or 1

    cutoff = now - timedelta(hours=settings.ABANDONED_CART_HOURS)
    abandoned = (
        Cart.objects.filter(updated_at__lt=cutoff, updated_at__gte=month, recovered_at__isnull=True)
        .annotate(n=Count("items")).filter(n__gt=0).count()
    )

    # Sales over the last 30 days
    by_day = dict(
        sales.filter(created_at__gte=month).annotate(day=TruncDate("created_at")).values_list("day")
        .annotate(revenue=Sum(value))
    )
    days = [(month + timedelta(days=i)).date() for i in range(30)]
    sales_chart = {
        "labels": [f"{day:%d %b}" for day in days],
        "datasets": [{
            "label": "Revenue (₹)", "data": [float(by_day.get(day) or 0) for day in days],
            "borderColor": "#7B4F3A", "backgroundColor": "rgba(200,168,130,.25)", "fill": True, "tension": 0.35,
        }],
    }

    items = OrderItem.objects.filter(order__in=sales.filter(created_at__gte=month))
    top = list(
        items.values("product_name").annotate(units=Sum("quantity"), revenue=Sum("line_total")).order_by("-revenue")[:6]
    )
    by_collection = list(
        items.values(name=F("product__primary_collection__name")).annotate(revenue=Sum("line_total")).order_by("-revenue")
    )
    collection_chart = {
        "labels": [row["name"] or "Other" for row in by_collection],
        "datasets": [{
            "label": "Revenue (₹)", "data": [float(row["revenue"] or 0) for row in by_collection],
            "backgroundColor": ["#7B4F3A", "#C8A882", "#C9A84C", "#2C4A3E", "#D4878A", "#B0AEB2"],
        }],
    }

    available = F("stock") - F("reserved")
    low_stock = list(
        Variant.objects.filter(is_active=True, product__status="active").annotate(avail=available)
        .filter(avail__lte=F("low_stock_threshold")).select_related("product").order_by("avail")[:8]
    )
    cod_unverified = Q(payment_method="cod", cod_verified=False, status=Order.Status.CONFIRMED)

    return {
        "kpis": [
            {"label": "Revenue today", "value": _money(d["revenue"]), "hint": f"{d['orders']} order(s)"},
            {"label": "Last 7 days", "value": _money(w["revenue"]), "hint": f"{w['orders']} order(s)"},
            {"label": "Last 30 days", "value": _money(m["revenue"]),
             "hint": f"{change:+d}% vs previous 30 days" if change is not None else f"{m['orders']} order(s)"},
            {"label": "Average order value", "value": _money(m["aov"]), "hint": "Last 30 days"},
            {"label": "New customers", "value": User.objects.filter(is_staff=False, date_joined__gte=month).count(),
             "hint": "Last 30 days"},
            {"label": "Abandoned carts", "value": abandoned, "hint": "Last 30 days, not recovered"},
        ],
        "cod_percent": round(cod / total_orders * 100),
        "prepaid_percent": 100 - round(cod / total_orders * 100),
        "sales_chart": json.dumps(sales_chart),
        "collection_chart": json.dumps(collection_chart),
        "top_products": [
            {"name": row["product_name"], "units": row["units"], "revenue": _money(row["revenue"])} for row in top
        ],
        "alerts": [
            {"label": "Orders to pack", "count": sales.filter(status=Order.Status.CONFIRMED).count(),
             "url": "/admin/orders/order/?status__exact=confirmed"},
            {"label": "COD orders to verify", "count": Order.objects.filter(cod_unverified).count(),
             "url": "/admin/orders/order/?status__exact=confirmed&payment_method__exact=cod&cod_verified__exact=0"},
            {"label": "Return requests", "count": ReturnRequest.objects.filter(status="requested").count(),
             "url": "/admin/returns/returnrequest/?status__exact=requested"},
            {"label": "Reviews to moderate", "count": Review.objects.filter(status="pending").count(),
             "url": "/admin/reviews/review/?status__exact=pending"},
        ],
        "low_stock": [
            {"sku": v.sku, "name": str(v), "available": v.avail, "url": f"/admin/catalog/variant/?q={v.sku}"}
            for v in low_stock
        ],
    }


def dashboard_callback(request, context):
    data = cache.get(CACHE_KEY)
    if data is None:
        data = compute()
        cache.set(CACHE_KEY, data, CACHE_SECONDS)
    context.update(data)
    return context
