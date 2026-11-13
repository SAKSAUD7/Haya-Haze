from django.urls import path

from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/facets/", views.FacetsView.as_view(), name="product-facets"),
    path("products/suggest/", views.SuggestView.as_view(), name="product-suggest"),
    path("products/<slug:slug>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("collections/", views.CollectionListView.as_view(), name="collection-list"),
    path("collections/<slug:slug>/", views.CollectionDetailView.as_view(), name="collection-detail"),
    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    path("wishlist/", views.WishlistView.as_view(), name="wishlist"),
    path("wishlist/<int:product_id>/", views.WishlistItemView.as_view(), name="wishlist-item"),
]
