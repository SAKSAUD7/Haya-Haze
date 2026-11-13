from django.urls import path

from . import views

urlpatterns = [
    path("site/", views.SiteConfigView.as_view(), name="site-config"),
    path("newsletter/", views.NewsletterView.as_view(), name="newsletter"),
    path("contact/", views.ContactView.as_view(), name="contact"),
    path("back-in-stock/", views.BackInStockView.as_view(), name="back-in-stock"),
]
