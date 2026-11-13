from django.urls import path

from . import views

urlpatterns = [path("returns/", views.ReturnsView.as_view(), name="returns")]
