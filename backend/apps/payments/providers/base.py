"""Payment provider interface.

To add a provider (Tabby, Tamara, PayPal...): subclass ``PaymentProvider``, implement
the three methods, and register it in ``providers/__init__.py``.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal


class PaymentError(Exception):
    pass


@dataclass
class PaymentSession:
    """What the storefront needs to start a payment."""

    provider: str
    provider_order_id: str
    amount: Decimal
    currency: str = "INR"
    # Provider-specific public data: Razorpay key id, Stripe redirect URL, sandbox flag...
    client: dict = field(default_factory=dict)


class PaymentProvider(ABC):
    code: str = ""
    label: str = ""

    @abstractmethod
    def is_configured(self) -> bool: ...

    @abstractmethod
    def create_session(self, order) -> PaymentSession:
        """Create the provider-side order/session for ``order.total``."""

    @abstractmethod
    def verify(self, payload: dict) -> tuple[str, str]:
        """Check a client callback. Returns ``(provider_order_id, provider_payment_id)``
        or raises PaymentError. Must be cryptographically verified, never trusted."""

    @abstractmethod
    def refund(self, payment, amount: Decimal, reason: str = "") -> str:
        """Refund ``amount``; returns the provider refund id."""


def to_minor(amount: Decimal) -> int:
    """Rupees → paise."""
    return int((amount * 100).to_integral_value())
