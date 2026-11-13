from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from .service import send_email, send_whatsapp_template


def _order(order_id):
    from apps.orders.models import Order

    return Order.objects.prefetch_related("items", "shipments").get(pk=order_id)


@shared_task
def send_welcome_email(user_id: int):
    from apps.accounts.models import User

    user = User.objects.get(pk=user_id)
    send_email("welcome", user.email, "Welcome to Haya & Haze", {"user": user})


@shared_task
def send_otp_email(email: str, code: str):
    send_email("otp", email, f"{code} is your Haya & Haze login code", {"code": code})


@shared_task
def send_password_reset_email(email: str, url: str):
    send_email("password_reset", email, "Reset your Haya & Haze password", {"url": url})


@shared_task
def send_order_confirmation(order_id: int):
    order = _order(order_id)
    send_email("order_confirmation", order.email, f"Order {order.number} confirmed", {"order": order}, order.number)
    send_whatsapp_template(order.phone, "order_confirmed", {"number": order.number}, order.number)
    send_email(
        "admin_new_order", settings.ADMIN_NOTIFY_EMAIL, f"New order {order.number} · ₹{order.grand_total}",
        {"order": order}, order.number,
    )


STATUS_SUBJECTS = {
    "packed": "Your order {n} is packed",
    "shipped": "Your order {n} is on its way",
    "out_for_delivery": "Your order {n} is out for delivery",
    "delivered": "Your order {n} has been delivered",
    "cancelled": "Your order {n} has been cancelled",
    "returned": "We have received your return for {n}",
    "refunded": "Your refund for {n} is on its way",
}


@shared_task
def send_order_status_email(order_id: int, status: str):
    subject = STATUS_SUBJECTS.get(status)
    if not subject:
        return
    order = _order(order_id)
    shipment = next(iter(order.shipments.all()), None)
    send_email(
        "order_status", order.email, subject.format(n=order.number),
        {"order": order, "status": status, "shipment": shipment}, order.number,
    )


@shared_task
def send_refund_email(order_id: int, amount: str):
    order = _order(order_id)
    send_email("refund", order.email, f"Refund issued for order {order.number}", {"order": order, "amount": amount}, order.number)


@shared_task
def send_return_update_email(return_id: int):
    from apps.returns.models import ReturnRequest

    req = ReturnRequest.objects.select_related("order").get(pk=return_id)
    send_email(
        "return_update", req.order.email, f"Update on your {req.get_kind_display().lower()} for {req.order.number}",
        {"req": req, "order": req.order}, req.order.number,
    )


@shared_task
def send_back_in_stock_emails(variant_id: int):
    from apps.catalog.models import Variant
    from apps.inventory.models import BackInStockRequest

    variant = Variant.objects.select_related("product").get(pk=variant_id)
    if variant.available <= 0:
        return 0
    pending = BackInStockRequest.objects.filter(variant=variant, notified_at__isnull=True)
    for req in pending:
        send_email("back_in_stock", req.email, f"{variant.product.name} is back in stock", {"variant": variant})
    return pending.update(notified_at=timezone.now())


@shared_task
def send_abandoned_cart_emails():
    """One gentle reminder for carts with an email that have sat untouched."""
    from apps.cart.models import Cart

    now = timezone.now()
    carts = (
        Cart.objects.filter(
            updated_at__lt=now - timedelta(hours=settings.ABANDONED_CART_HOURS),
            updated_at__gt=now - timedelta(days=7),
            recovery_email_sent_at__isnull=True,
        )
        .annotate(n=Count("items"))
        .filter(n__gt=0)
        .select_related("user")
    )
    sent = 0
    for cart in carts:
        email = cart.user.email if cart.user_id else cart.email
        if not email:
            continue
        items = cart.items.filter(saved_for_later=False).select_related("variant__product")[:4]
        if send_email("abandoned_cart", email, "You left something beautiful behind", {"items": items, "cart": cart}):
            Cart.objects.filter(pk=cart.pk).update(recovery_email_sent_at=now)
            sent += 1
    return sent


@shared_task
def send_contact_notification(message_id: int):
    from apps.core.models import ContactMessage

    msg = ContactMessage.objects.get(pk=message_id)
    send_email("admin_contact", settings.ADMIN_NOTIFY_EMAIL, f"New message from {msg.name}", {"msg": msg})
