from .base import PaymentError, PaymentProvider, PaymentSession
from .razorpay_provider import RazorpayProvider
from .stripe_provider import StripeProvider

# Online providers. Cash on Delivery has no provider: nothing is charged at checkout.
PROVIDERS: dict[str, PaymentProvider] = {p.code: p for p in (RazorpayProvider(), StripeProvider())}


def get_provider(code: str) -> PaymentProvider:
    provider = PROVIDERS.get(code)
    if provider is None or not provider.is_configured():
        raise PaymentError("This payment method is not available.")
    return provider


__all__ = ["PROVIDERS", "PaymentError", "PaymentProvider", "PaymentSession", "get_provider"]
