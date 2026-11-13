from django.urls import path

from . import views

urlpatterns = [
    path("reviews/featured/", views.FeaturedReviewsView.as_view(), name="reviews-featured"),
    path("products/<slug:slug>/reviews/", views.ProductReviewsView.as_view(), name="product-reviews"),
]
