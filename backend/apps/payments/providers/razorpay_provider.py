import hashlib
import hmac
import secrets
from decimal import Decimal

from django.conf import settings

from .base import PaymentError, PaymentProvider, PaymentSession, to_minor

SANDBOX_SECRET = "sandbox-secret-not-for-production"


def _sign(message: str, secret: str) -> str:
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


class RazorpayProvider(PaymentProvider):
    code = "razorpay"
    label = "UPI, cards, netbanking & wallets"

    @property
    def sandbox(self) -> bool:
        return settings.PAYMENTS_SANDBOX

    def is_configured(self) -> bool:
        return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET) or self.sandbox

    def _client(self):
        import razorpay

        return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    def create_session(self, order) -> PaymentSession:
        if self.sandbox:
            oid = f"sandbox_order_{secrets.token_hex(8)}"
            return PaymentSession(self.code, oid, order.total, client={"sandbox": True})
        try:
            rp_order = self._client().order.create({
                "amount": to_minor(order.total), "currency": "INR", "receipt": order.number,
                "notes": {"order_number": order.number},
            })
        except Exception as exc:  # network / auth errors from the SDK
            raise PaymentError("We could not reach the payment gateway. Please try again.") from exc
        return PaymentSession(
            self.code, rp_order["id"], order.total,
            client={"sandbox": False, "key_id": settings.RAZORPAY_KEY_ID, "amount": rp_order["amount"]},
        )

    def verify(self, payload: dict) -> tuple[str, str]:
        order_id = payload.get("razorpay_order_id", "")
        payment_id = payload.get("razorpay_payment_id", "")
        signature = payload.get("razorpay_signature", "")
        if not (order_id and payment_id and signature):
            raise PaymentError("Incomplete payment confirmation.")
        secret = SANDBOX_SECRET if self.sandbox else settings.RAZORPAY_KEY_SECRET
        if not hmac.compare_digest(_sign(f"{order_id}|{payment_id}", secret), signature):
            raise PaymentError("Payment signature did not match.")
        return order_id, payment_id

    def sandbox_confirmation(self, provider_order_id: str) -> dict:
        """Build the callback a real Razorpay checkout would send. Sandbox only."""
        if not self.sandbox:
            raise PaymentError("Sandbox payments are disabled.")
        payment_id = f"sandbox_pay_{secrets.token_hex(8)}"
        return {
            "razorpay_order_id": provider_order_id, "razorpay_payment_id": payment_id,
            "razorpay_signature": _sign(f"{provider_order_id}|{payment_id}", SANDBOX_SECRET),
        }

    @staticmethod
    def verify_webhook(body: bytes, signature: str) -> bool:
        secret = settings.RAZORPAY_WEBHOOK_SECRET
        if not secret or not signature:
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def refund(self, payment, amount: Decimal, reason: str = "") -> str:
        if payment.is_sandbox:
            return f"sandbox_rfnd_{secrets.token_hex(6)}"
        try:
            result = self._client().payment.refund(
                payment.provider_payment_id, {"amount": to_minor(amount), "notes": {"reason": reason[:200]}}
            )
        except Exception as exc:
            raise PaymentError(f"Razorpay refund failed: {exc}") from exc
        return result["id"]
