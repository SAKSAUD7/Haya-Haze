from django.urls import path

from . import views

urlpatterns = [
    path("payments/methods/", views.PaymentMethodsView.as_view(), name="payment-methods"),
    path("payments/retry/<str:number>/", views.RetryPaymentView.as_view(), name="payment-retry"),
    path("payments/razorpay/verify/", views.RazorpayVerifyView.as_view(), name="razorpay-verify"),
    path("payments/razorpay/webhook/", views.RazorpayWebhookView.as_view(), name="razorpay-webhook"),
    path("payments/stripe/verify/", views.StripeVerifyView.as_view(), name="stripe-verify"),
    path("payments/stripe/webhook/", views.StripeWebhookView.as_view(), name="stripe-webhook"),
    path("payments/sandbox/pay/", views.SandboxPayView.as_view(), name="sandbox-pay"),
]
