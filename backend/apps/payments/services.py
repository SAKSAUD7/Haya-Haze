from decimal import Decimal

from django.db import transaction

from apps.core.exceptions import CommerceError
from apps.orders import services as order_services
from apps.orders.models import Order

from .models import Payment, Refund
from .providers import PaymentError, get_provider


def start_payment(order) -> dict:
    """Create (or reuse) the provider session for an order awaiting payment."""
    if order.status != Order.Status.PENDING:
        raise CommerceError("This order is not awaiting payment.", code="not_payable")
    payment = order.payments.filter(status=Payment.Status.CREATED, provider=order.payment_method).first()
    if payment is None or order.payment_method == "stripe":
        try:
            session = get_provider(order.payment_method).create_session(order)
        except PaymentError as exc:
            raise CommerceError(str(exc), code="payment_unavailable")
        payment = Payment.objects.create(
            order=order, provider=session.provider, provider_order_id=session.provider_order_id,
            amount=session.amount, currency=session.currency,
            is_sandbox=bool(session.client.get("sandbox")), raw={"client": session.client},
        )
    return {
        "provider": payment.provider,
        "provider_order_id": payment.provider_order_id,
        "amount": str(payment.amount),
        "currency": payment.currency,
        **payment.raw.get("client", {}),
    }


def confirm_payment(provider_code: str, payload: dict) -> Order:
    """Verify a client callback and mark the order paid. Idempotent."""
    try:
        provider_order_id, provider_payment_id = get_provider(provider_code).verify(payload)
    except PaymentError as exc:
        raise CommerceError(str(exc), code="payment_verification_failed")
    return settle(provider_code, provider_order_id, provider_payment_id)


@transaction.atomic
def settle(provider_code: str, provider_order_id: str, provider_payment_id: str, method: str = "") -> Order:
    payment = (
        Payment.objects.select_for_update()
        .filter(provider=provider_code, provider_order_id=provider_order_id)
        .first()
    )
    if payment is None:
        raise CommerceError("We could not match this payment to an order.", code="payment_unknown")
    if payment.status != Payment.Status.PAID:
        payment.status = Payment.Status.PAID
        payment.provider_payment_id = provider_payment_id
        payment.method = method or payment.method
        payment.save(update_fields=["status", "provider_payment_id", "method", "updated_at"])
    return order_services.mark_paid(payment.order_id)


@transaction.atomic
def fail(provider_code: str, provider_order_id: str, reason: str = "") -> None:
    payment = Payment.objects.select_for_update().filter(provider=provider_code, provider_order_id=provider_order_id).first()
    if payment and payment.status == Payment.Status.CREATED:
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=["status", "updated_at"])
        order_services.mark_payment_failed(payment.order_id, reason)


@transaction.atomic
def refund_order(order, amount: Decimal | None = None, reason: str = "", user=None) -> Refund | None:
    """Refund through the original provider. COD orders are only recorded."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    remaining = order.total - order.refunded_total
    amount = remaining if amount is None else Decimal(amount)
    if amount <= 0 or amount > remaining:
        raise CommerceError(f"Refund must be between ₹0.01 and ₹{remaining}.")
    refund = None
    payment = order.payments.filter(status__in=[Payment.Status.PAID, Payment.Status.REFUNDED]).first()
    if payment:
        try:
            refund_id = get_provider(payment.provider).refund(payment, amount, reason)
        except PaymentError as exc:
            raise CommerceError(str(exc))
        refund = Refund.objects.create(payment=payment, amount=amount, provider_refund_id=refund_id, reason=reason[:200])
        payment.status = Payment.Status.REFUNDED
        payment.save(update_fields=["status", "updated_at"])
    order.refunded_total += amount
    full = order.refunded_total >= order.total
    if full:
        order.payment_status = Order.PaymentStatus.REFUNDED
    order.save(update_fields=["refunded_total", "payment_status", "updated_at"])
    order_services.add_event(
        order, Order.Status.REFUNDED if full else "", f"Refund of ₹{amount} issued." + (f" {reason}" if reason else ""),
        user=user,
    )
    order_services._notify("send_refund_email", order.pk, str(amount))
    return refund
