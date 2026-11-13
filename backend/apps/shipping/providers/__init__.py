from .base import ShipmentResult, ShippingError, ShippingProvider
from .shiprocket import ShiprocketProvider


class ManualProvider(ShippingProvider):
    """No courier API: staff type the AWB and courier into the shipment in the admin."""

    code = "manual"

    def is_configured(self) -> bool:
        return True

    def create_shipment(self, order) -> ShipmentResult:
        return ShipmentResult()

    def track(self, awb: str) -> dict:
        return {"status": None, "events": []}


PROVIDERS: dict[str, ShippingProvider] = {p.code: p for p in (ShiprocketProvider(), ManualProvider())}


def default_provider() -> ShippingProvider:
    shiprocket = PROVIDERS["shiprocket"]
    return shiprocket if shiprocket.is_configured() else PROVIDERS["manual"]


__all__ = ["PROVIDERS", "ShipmentResult", "ShippingError", "ShippingProvider", "default_provider"]
