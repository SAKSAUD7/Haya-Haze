"""Server-side Meta Conversions API hook.

Browser pixels miss a share of purchases (ad blockers, iOS). Sending the Purchase event
from the server as well lets Meta de-duplicate on ``event_id`` and attribute correctly.
Active only when both a pixel id (Store settings) and META_PIXEL_ACCESS_TOKEN are set.
"""
import hashlib
import logging
import time

import requests
from django.conf import settings

from apps.core.models import SiteSettings

log = logging.getLogger(__name__)


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def send_purchase(order) -> bool:
    pixel_id = SiteSettings.load().meta_pixel_id
    token = settings.META_PIXEL_ACCESS_TOKEN
    if not (pixel_id and token):
        return False
    event = {
        "event_name": "Purchase",
        "event_time": int(time.time()),
        "event_id": order.number,  # the browser pixel sends the same id
        "action_source": "website",
        "user_data": {"em": [_hash(order.email)], "ph": [_hash(order.phone)]},
        "custom_data": {
            "currency": "INR", "value": float(order.grand_total),
            "contents": [{"id": i.sku, "quantity": i.quantity} for i in order.items.all()],
        },
    }
    try:
        resp = requests.post(
            f"https://graph.facebook.com/v19.0/{pixel_id}/events",
            json={"data": [event], "access_token": token}, timeout=10,
        )
        return resp.ok
    except requests.RequestException:
        log.warning("Meta Conversions API call failed for %s", order.number)
        return False
