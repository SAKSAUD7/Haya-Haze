from django.urls import path

from . import views

urlpatterns = [
    path("checkout/place/", views.PlaceOrderView.as_view(), name="checkout-place"),
    path("orders/", views.OrderListView.as_view(), name="order-list"),
    path("orders/track/", views.TrackOrderView.as_view(), name="order-track"),
    path("orders/<str:number>/", views.OrderDetailView.as_view(), name="order-detail"),
    path("orders/<str:number>/cancel/", views.OrderCancelView.as_view(), name="order-cancel"),
    path("orders/<str:number>/reorder/", views.OrderReorderView.as_view(), name="order-reorder"),
    path("orders/<str:number>/invoice/", views.OrderInvoiceView.as_view(), name="order-invoice"),
]
