from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.views import LogoutView, PasswordChangeView, UserDetailsView
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("addresses", views.AddressViewSet, basename="address")

urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view(), name="csrf"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/user/", UserDetailsView.as_view(), name="user"),
    path("auth/token/refresh/", get_refresh_view().as_view(), name="token-refresh"),
    path("auth/password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("auth/password/reset/", views.PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password/reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/otp/request/", views.OTPRequestView.as_view(), name="otp-request"),
    path("auth/otp/verify/", views.OTPVerifyView.as_view(), name="otp-verify"),
    path("auth/google/", views.GoogleLoginView.as_view(), name="google-login"),
    path("account/", include(router.urls)),
]
