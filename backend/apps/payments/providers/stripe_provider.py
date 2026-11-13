from decimal import Decimal

from django.conf import settings

from .base import PaymentError, PaymentProvider, PaymentSession, to_minor


class StripeProvider(PaymentProvider):
    """Stripe Checkout (hosted page) for international cards."""

    code = "stripe"
    label = "International cards"

    def is_configured(self) -> bool:
        return bool(settings.STRIPE_SECRET_KEY)

    def _stripe(self):
        import stripe

        stripe.api_key = settings.STRIPE_SECRET_KEY
        return stripe

    def create_session(self, order) -> PaymentSession:
        stripe = self._stripe()
        try:
            session = stripe.checkout.Session.create(
                mode="payment",
                customer_email=order.email,
                client_reference_id=order.number,
                line_items=[{
                    "quantity": 1,
                    "price_data": {
                        "currency": "inr",
                        "unit_amount": to_minor(order.total),
                        "product_data": {"name": f"Haya & Haze order {order.number}"},
                    },
                }],
                success_url=f"{settings.FRONTEND_URL}/checkout/success/{order.number}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.FRONTEND_URL}/checkout?cancelled={order.number}",
                metadata={"order_number": order.number},
            )
        except Exception as exc:
            raise PaymentError("We could not start the card payment. Please try again.") from exc
        return PaymentSession(self.code, session.id, order.total, client={"redirect_url": session.url})

    def verify(self, payload: dict) -> tuple[str, str]:
        session_id = payload.get("session_id", "")
        if not session_id:
            raise PaymentError("Missing Stripe session.")
        try:
            session = self._stripe().checkout.Session.retrieve(session_id)
        except Exception as exc:
            raise PaymentError("Could not confirm the payment with Stripe.") from exc
        if session.payment_status != "paid":
            raise PaymentError("This payment has not completed.")
        return session.id, str(session.payment_intent or "")

    @staticmethod
    def parse_webhook(body: bytes, signature: str):
        import stripe

        return stripe.Webhook.construct_event(body, signature, settings.STRIPE_WEBHOOK_SECRET)

    def refund(self, payment, amount: Decimal, reason: str = "") -> str:
        try:
            refund = self._stripe().Refund.create(payment_intent=payment.provider_payment_id, amount=to_minor(amount))
        except Exception as exc:
            raise PaymentError(f"Stripe refund failed: {exc}") from exc
        return refund.id
