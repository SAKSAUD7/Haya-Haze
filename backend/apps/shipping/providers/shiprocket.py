import requests
from django.conf import settings
from django.core.cache import cache

from .base import ShipmentResult, ShippingError, ShippingProvider

API = "https://apiv2.shiprocket.in/v1/external"
TOKEN_CACHE_KEY = "shiprocket:token"

# Shiprocket status text → our Shipment.Status values
STATUS_MAP = {
    "PICKED UP": "picked_up",
    "SHIPPED": "in_transit",
    "IN TRANSIT": "in_transit",
    "REACHED AT DESTINATION HUB": "in_transit",
    "OUT FOR DELIVERY": "out_for_delivery",
    "DELIVERED": "delivered",
    "RTO INITIATED": "rto",
    "RTO DELIVERED": "rto",
    "CANCELED": "cancelled",
    "CANCELLED": "cancelled",
}


def map_status(text: str) -> str | None:
    return STATUS_MAP.get((text or "").strip().upper())


class ShiprocketProvider(ShippingProvider):
    code = "shiprocket"

    def is_configured(self) -> bool:
        return bool(settings.SHIPROCKET_EMAIL and settings.SHIPROCKET_PASSWORD)

    def _token(self) -> str:
        token = cache.get(TOKEN_CACHE_KEY)
        if token:
            return token
        resp = requests.post(
            f"{API}/auth/login",
            json={"email": settings.SHIPROCKET_EMAIL, "password": settings.SHIPROCKET_PASSWORD}, timeout=20,
        )
        if resp.status_code != 200:
            raise ShippingError("Shiprocket login failed. Check SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.")
        token = resp.json()["token"]
        cache.set(TOKEN_CACHE_KEY, token, 60 * 60 * 24 * 8)  # tokens last 10 days
        return token

    def _request(self, method: str, path: str, **kwargs) -> dict:
        try:
            resp = requests.request(
                method, f"{API}{path}", headers={"Authorization": f"Bearer {self._token()}"}, timeout=30, **kwargs
            )
        except requests.RequestException as exc:
            raise ShippingError(f"Could not reach Shiprocket: {exc}") from exc
        if resp.status_code == 401:
            cache.delete(TOKEN_CACHE_KEY)
        if resp.status_code >= 400:
            raise ShippingError(f"Shiprocket error {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def create_shipment(self, order) -> ShipmentResult:
        items = list(order.items.all())
        weight_kg = max(sum(i.weight_grams * i.quantity for i in items) / 1000, 0.1)
        first, _, last = order.ship_name.partition(" ")
        payload = {
            "order_id": order.number,
            "order_date": (order.placed_at or order.created_at).strftime("%Y-%m-%d %H:%M"),
            "pickup_location": settings.SHIPROCKET_PICKUP_LOCATION,
            "billing_customer_name": first, "billing_last_name": last,
            "billing_address": order.ship_line1, "billing_address_2": order.ship_line2,
            "billing_city": order.ship_city, "billing_pincode": order.ship_pincode,
            "billing_state": order.ship_state, "billing_country": "India",
            "billing_email": order.email, "billing_phone": order.phone[-10:],
            "shipping_is_billing": True,
            "order_items": [
                {
                    "name": f"{i.product_name} {i.variant_label}".strip(), "sku": i.sku, "units": i.quantity,
                    "selling_price": str(i.unit_price), "hsn": i.hsn_code, "tax": str(i.gst_rate),
                }
                for i in items
            ],
            "payment_method": "COD" if order.payment_method == "cod" else "Prepaid",
            "sub_total": str(order.total if order.payment_method == "cod" else order.grand_total),
            "length": 30, "breadth": 25, "height": 5, "weight": round(weight_kg, 2),
        }
        created = self._request("POST", "/orders/create/adhoc", json=payload)
        shipment_id = str(created.get("shipment_id", ""))
        result = ShipmentResult(provider_shipment_id=shipment_id, raw={"order": created})
        if shipment_id:
            awb = self._request("POST", "/courier/assign/awb", json={"shipment_id": shipment_id})
            data = (awb.get("response") or {}).get("data") or {}
            result.awb = str(data.get("awb_code", ""))
            result.courier = data.get("courier_name", "")
            result.raw["awb"] = awb
            if result.awb:
                result.tracking_url = f"https://shiprocket.co/tracking/{result.awb}"
        return result

    def track(self, awb: str) -> dict:
        data = self._request("GET", f"/courier/track/awb/{awb}").get("tracking_data", {})
        tracks = data.get("shipment_track") or [{}]
        return {
            "status": map_status(tracks[0].get("current_status", "")),
            "events": [
                {"date": a.get("date"), "activity": a.get("activity"), "location": a.get("location")}
                for a in data.get("shipment_track_activities") or []
            ],
        }
