"""Stock is only ever changed here.

Every function locks the variant rows it touches (``select_for_update``) inside a
transaction, so two shoppers can never buy the same last unit.
"""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.catalog.models import Variant
from apps.core.exceptions import CommerceError

from .models import StockMovement, StockReservation


def _lock(variant_ids) -> dict[int, Variant]:
    # Ordered by pk so concurrent checkouts always lock rows in the same order.
    rows = Variant.objects.select_for_update().select_related("product").filter(pk__in=variant_ids).order_by("pk")
    return {v.pk: v for v in rows}


@transaction.atomic
def reserve_for_order(order, lines: list[tuple[int, int]]) -> None:
    """Hold stock for ``[(variant_id, qty)]``. Raises CommerceError if any line is short."""
    variants = _lock([vid for vid, _ in lines])
    expires = timezone.now() + timedelta(minutes=settings.STOCK_RESERVATION_MINUTES)
    for variant_id, qty in lines:
        variant = variants.get(variant_id)
        if variant is None or not variant.is_active:
            raise CommerceError("One of the items in your bag is no longer available.", code="unavailable")
        if variant.available < qty:
            left = variant.available
            msg = f"Only {left} left of {variant}." if left else f"{variant} just sold out."
            raise CommerceError(msg, code="insufficient_stock")
        variant.reserved = F("reserved") + qty
        variant.save(update_fields=["reserved"])
        StockReservation.objects.create(variant_id=variant_id, order=order, quantity=qty, expires_at=expires)


@transaction.atomic
def commit_order(order) -> None:
    """Payment succeeded (or COD confirmed): turn held stock into sold stock."""
    held = list(order.reservations.select_for_update().filter(state=StockReservation.State.HELD))
    variants = _lock([r.variant_id for r in held])
    for res in held:
        variant = variants[res.variant_id]
        variant.stock = max(variant.stock - res.quantity, 0)
        variant.reserved = max(variant.reserved - res.quantity, 0)
        variant.save(update_fields=["stock", "reserved"])
        StockMovement.objects.create(
            variant=variant, delta=-res.quantity, stock_after=variant.stock,
            reason=StockMovement.Reason.SALE, reference=order.number,
        )
        res.state = StockReservation.State.COMMITTED
        res.save(update_fields=["state", "updated_at"])


@transaction.atomic
def release_order(order) -> int:
    """Payment failed or timed out: give held stock back."""
    held = list(order.reservations.select_for_update().filter(state=StockReservation.State.HELD))
    variants = _lock([r.variant_id for r in held])
    for res in held:
        variant = variants[res.variant_id]
        variant.reserved = max(variant.reserved - res.quantity, 0)
        variant.save(update_fields=["reserved"])
        res.state = StockReservation.State.RELEASED
        res.save(update_fields=["state", "updated_at"])
    return len(held)


@transaction.atomic
def restock_order(order, reason=StockMovement.Reason.CANCELLATION) -> None:
    """A paid/confirmed order was cancelled or returned: put sold units back."""
    committed = list(order.reservations.select_for_update().filter(state=StockReservation.State.COMMITTED))
    variants = _lock([r.variant_id for r in committed])
    for res in committed:
        variant = variants[res.variant_id]
        was_out = variant.available == 0
        variant.stock += res.quantity
        variant.save(update_fields=["stock"])
        StockMovement.objects.create(
            variant=variant, delta=res.quantity, stock_after=variant.stock, reason=reason, reference=order.number
        )
        res.state = StockReservation.State.RELEASED
        res.save(update_fields=["state", "updated_at"])
        if was_out:
            _notify_back_in_stock(variant.pk)


@transaction.atomic
def adjust_stock(variant_id: int, new_stock: int, user=None, reason=StockMovement.Reason.ADJUSTMENT, note="") -> None:
    variant = _lock([variant_id])[variant_id]
    delta = new_stock - variant.stock
    if delta == 0:
        return
    if new_stock < variant.reserved:
        raise CommerceError(f"{variant.reserved} units are reserved by open orders; stock cannot go below that.")
    was_out = variant.available == 0
    variant.stock = new_stock
    variant.save(update_fields=["stock"])
    StockMovement.objects.create(
        variant=variant, delta=delta, stock_after=new_stock, reason=reason, reference=note[:60], user=user
    )
    if was_out and delta > 0:
        _notify_back_in_stock(variant_id)


def _notify_back_in_stock(variant_id: int) -> None:
    from apps.notifications.tasks import send_back_in_stock_emails

    transaction.on_commit(lambda: send_back_in_stock_emails.delay(variant_id))
