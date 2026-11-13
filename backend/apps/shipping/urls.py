from django.urls import path

from . import views

urlpatterns = [
    path("shipping/pincode/<str:pincode>/", views.PincodeView.as_view(), name="pincode-check"),
    path("shipping/webhook/shiprocket/", views.ShiprocketWebhookView.as_view(), name="shiprocket-webhook"),
]
