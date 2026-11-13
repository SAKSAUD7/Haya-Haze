from celery import shared_task
from django.utils import timezone


@shared_task
def release_expired_reservations() -> int:
    """Cancel unpaid orders whose stock hold has lapsed and return the stock."""
    from apps.orders.models import Order
    from apps.orders.services import cancel_order

    from .models import StockReservation

    order_ids = (
        StockReservation.objects.filter(state=StockReservation.State.HELD, expires_at__lt=timezone.now())
        .values_list("order_id", flat=True)
        .distinct()
    )
    count = 0
    for order in Order.objects.filter(pk__in=list(order_ids), status=Order.Status.PENDING):
        cancel_order(order, note="Payment was not completed in time.", notify=False)
        count += 1
    return count


def release_lapsed_holds_inline() -> None:
    """Without Celery beat (local mode, Render free plan) nothing runs the task above on a
    schedule, so the shopping endpoints call this first. With a scheduler it does nothing."""
    from django.conf import settings

    if settings.CELERY_TASK_ALWAYS_EAGER:
        release_expired_reservations()
