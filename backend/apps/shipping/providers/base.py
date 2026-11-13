"""Shipping provider interface.

To add a courier (Delhivery, BlueDart, DTDC...): subclass ``ShippingProvider`` and
register it in ``providers/__init__.py``.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ShippingError(Exception):
    pass


@dataclass
class ShipmentResult:
    provider_shipment_id: str = ""
    awb: str = ""
    courier: str = ""
    tracking_url: str = ""
    label_url: str = ""
    raw: dict = field(default_factory=dict)


class ShippingProvider(ABC):
    code: str = ""

    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    def create_shipment(self, order) -> ShipmentResult:
        """Book the shipment with the courier and return its AWB."""

    @abstractmethod
    def track(self, awb: str) -> dict:
        """Return ``{"status": <Shipment.Status value>, "events": [...]}``."""
