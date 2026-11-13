import re
from datetime import timedelta

from django.utils import timezone

from apps.core.exceptions import CommerceError
from apps.core.models import SiteSettings
from apps.orders import services as order_services
from apps.orders.models import Order

from .models import ServiceablePincode, Shipment
from .providers import ShippingError, default_provider

# First two digits of an Indian PIN code → state / union territory.
PIN_PREFIX_STATES = {
    "11": "Delhi", "12": "Haryana", "13": "Haryana", "14": "Punjab", "15": "Punjab", "16": "Chandigarh",
    "17": "Himachal Pradesh", "18": "Jammu and Kashmir", "19": "Jammu and Kashmir",
    **{str(n): "Uttar Pradesh" for n in range(20, 29)},
    **{str(n): "Rajasthan" for n in range(30, 35)},
    **{str(n): "Gujarat" for n in range(36, 40)},
    **{str(n): "Maharashtra" for n in range(40, 45)},
    **{str(n): "Madhya Pradesh" for n in range(45, 49)}, "49": "Chhattisgarh",
    **{str(n): "Telangana" for n in range(50, 51)}, "51": "Andhra Pradesh", "52": "Andhra Pradesh", "53": "Andhra Pradesh",
    **{str(n): "Karnataka" for n in range(56, 60)},
    **{str(n): "Tamil Nadu" for n in range(60, 67)},
    **{str(n): "Kerala" for n in range(67, 70)},
    **{str(n): "West Bengal" for n in range(70, 75)},
    **{str(n): "Odisha" for n in range(75, 78)}, "78": "Assam", "79": "North East",
    **{str(n): "Bihar" for n in range(80, 86)}, "81": "Jharkhand", "82": "Jharkhand", "83": "Jharkhand",
}

PIN_RE = re.compile(r"^[1-9][0-9]{5}$")


def _eta(days: str) -> str:
    """'5-7' → 'Sat 21 Nov – Mon 23 Nov'."""
    try:
        low, _, high = days.partition("-")
        start = timezone.localdate() + timedelta(days=int(low))
        end = timezone.localdate() + timedelta(days=int(high or low))
    except ValueError:
        return ""
    return f"{start:%a %d %b} – {end:%a %d %b}"


def check_pincode(pincode: str) -> dict:
    pincode = (pincode or "").strip()
    cfg = SiteSettings.load()
    base = {
        "pincode": pincode, "serviceable": False, "cod_available": False, "city": "", "state": "",
        "standard_days": cfg.standard_delivery_days, "express_days": cfg.express_delivery_days,
        "standard_eta": "", "express_eta": "", "message": "",
    }
    if not PIN_RE.match(pincode):
        base["message"] = "Please enter a valid 6-digit pincode."
        return base
    row = ServiceablePincode.objects.filter(pincode=pincode).first()
    if row:
        base.update(
            serviceable=row.is_serviceable, cod_available=row.is_serviceable and row.cod_available and cfg.cod_enabled,
            city=row.city, state=row.state,
            standard_days=row.standard_days or cfg.standard_delivery_days,
            express_days=row.express_days or cfg.express_delivery_days,
        )
    else:
        base.update(
            serviceable=cfg.ship_to_unlisted_pincodes, cod_available=cfg.ship_to_unlisted_pincodes and cfg.cod_enabled,
            state=PIN_PREFIX_STATES.get(pincode[:2], ""),
        )
    if base["serviceable"]:
        base["standard_eta"], base["express_eta"] = _eta(base["standard_days"]), _eta(base["express_days"])
        base["message"] = f"Delivery by {base['standard_eta'].split(' – ')[-1]}" if base["standard_eta"] else "We deliver here."
    else:
        base["message"] = "Sorry, we do not deliver to this pincode yet."
    return base


def create_shipment(order, user=None) -> Shipment:
    if order.status not in (Order.Status.CONFIRMED, Order.Status.PACKED):
        raise CommerceError("Only confirmed or packed orders can be shipped.")
    if order.payment_method == Order.PaymentMethod.COD and not order.cod_verified:
        raise CommerceError("Verify this COD order with the customer before shipping it.")
    provider = default_provider()
    try:
        result = provider.create_shipment(order)
    except ShippingError as exc:
        raise CommerceError(str(exc))
    shipment = Shipment.objects.create(
        order=order, provider=provider.code, provider_shipment_id=result.provider_shipment_id, awb=result.awb,
        courier=result.courier, tracking_url=result.tracking_url, label_url=result.label_url, raw=result.raw,
    )
    if result.awb:
        order_services.transition(order, Order.Status.SHIPPED, user=user, note=_shipped_note(shipment))
    return shipment


def _shipped_note(shipment: Shipment) -> str:
    via = f" with {shipment.courier}" if shipment.courier else ""
    return f"Shipped{via}. Tracking number {shipment.awb}." if shipment.awb else "Your order is on its way."


SHIPMENT_TO_ORDER = {
    Shipment.Status.PICKED_UP: Order.Status.SHIPPED,
    Shipment.Status.IN_TRANSIT: Order.Status.SHIPPED,
    Shipment.Status.OUT_FOR_DELIVERY: Order.Status.OUT_FOR_DELIVERY,
    Shipment.Status.DELIVERED: Order.Status.DELIVERED,
}


def apply_tracking_update(awb: str, status: str) -> bool:
    """Apply a courier status (from a webhook or a poll) to the shipment and its order."""
    shipment = Shipment.objects.select_related("order").filter(awb=awb).first()
    if not shipment or status not in Shipment.Status.values or shipment.status == status:
        return False
    shipment.status = status
    shipment.save(update_fields=["status", "updated_at"])
    target = SHIPMENT_TO_ORDER.get(status)
    order = shipment.order
    flow = Order.FLOW
    if target and order.status in flow and flow.index(target) > flow.index(order.status):
        note = _shipped_note(shipment) if target == Order.Status.SHIPPED else ""
        order_services.transition(order, target, note=note)
    elif status == Shipment.Status.RTO:
        order_services.add_event(order, note="Courier is returning the parcel to us (RTO).", public=False)
    return True
