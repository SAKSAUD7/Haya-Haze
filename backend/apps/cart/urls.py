from django.urls import path

from . import views

urlpatterns = [
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/items/", views.CartItemsView.as_view(), name="cart-items"),
    path("cart/items/<int:item_id>/", views.CartItemView.as_view(), name="cart-item"),
    path("cart/coupon/", views.CartCouponView.as_view(), name="cart-coupon"),
    path("cart/gift-card/", views.CartGiftCardView.as_view(), name="cart-gift-card"),
]
