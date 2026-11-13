from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.jwt_auth import set_jwt_cookies
from dj_rest_auth.registration.views import SocialLoginView
from dj_rest_auth.views import LoginView as BaseLoginView
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.middleware.csrf import get_token
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.cart.services import merge_guest_cart
from apps.notifications import tasks
from apps.promotions.models import Subscriber

from .models import Address, EmailOTP, User
from .serializers import (
    AddressSerializer,
    DetailSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)


def login_response(request, user, status=200) -> Response:
    """Sign ``user`` in: JWT cookies, plus the guest cart folded into their account."""
    refresh = RefreshToken.for_user(user)
    response = Response(UserSerializer(user).data, status=status)
    set_jwt_cookies(response, refresh.access_token, refresh)
    merge_guest_cart(request, user)
    response.delete_cookie(settings.CART_COOKIE_NAME)
    get_token(request)  # make sure the CSRF cookie is issued alongside the session
    return response


class CsrfView(APIView):
    @extend_schema(responses={200: {"type": "object", "properties": {"csrfToken": {"type": "string"}}}})
    def get(self, request):
        """Issues the CSRF cookie the storefront echoes back on unsafe requests."""
        return Response({"csrfToken": get_token(request)})


class LoginView(BaseLoginView):
    throttle_scope = "auth"

    def get_response(self):
        response = super().get_response()
        merge_guest_cart(self.request, self.user)
        response.delete_cookie(settings.CART_COOKIE_NAME)
        get_token(self.request)
        response.data = UserSerializer(self.user).data
        return response


class RegisterView(APIView):
    throttle_scope = "auth"

    @extend_schema(request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = User.objects.create_user(
            email=data["email"], password=data["password"], first_name=data["first_name"],
            last_name=data["last_name"], accepts_marketing=data["accepts_marketing"],
        )
        if user.accepts_marketing:
            Subscriber.objects.update_or_create(email=user.email, defaults={"user": user, "source": "signup", "is_active": True})
        tasks.send_welcome_email.delay(user.pk)
        return login_response(request, user, status=201)


class OTPRequestView(APIView):
    throttle_scope = "otp"

    @extend_schema(request=OTPRequestSerializer, responses=DetailSerializer)
    def post(self, request):
        """Email a 6-digit login code. Works for new and returning customers."""
        ser = OTPRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].lower()
        tasks.send_otp_email.delay(email, EmailOTP.issue(email))
        return Response({"detail": "We have emailed you a 6-digit code. It is valid for 10 minutes."})


class OTPVerifyView(APIView):
    throttle_scope = "otp"

    @extend_schema(request=OTPVerifySerializer, responses=UserSerializer)
    def post(self, request):
        ser = OTPVerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].lower()
        if not EmailOTP.verify(email, ser.validated_data["code"]):
            raise ValidationError({"code": ["That code is incorrect or has expired."]})
        user, created = User.objects.get_or_create(email=email)
        if created:
            user.set_unusable_password()
            user.save()
            tasks.send_welcome_email.delay(user.pk)
        return login_response(request, user)


class PasswordResetRequestView(APIView):
    throttle_scope = "auth"

    @extend_schema(request=PasswordResetRequestSerializer, responses=DetailSerializer)
    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.filter(email=ser.validated_data["email"].lower(), is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            url = f"{settings.FRONTEND_URL}/account/reset-password?uid={uid}&token={token}"
            tasks.send_password_reset_email.delay(user.email, url)
        # Same answer either way, so the form cannot be used to discover accounts.
        return Response({"detail": "If that email has an account, a reset link is on its way."})


class PasswordResetConfirmView(APIView):
    throttle_scope = "auth"

    @extend_schema(request=PasswordResetConfirmSerializer, responses=DetailSerializer)
    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(ser.validated_data["uid"])))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, ser.validated_data["token"]):
            raise ValidationError({"token": ["This reset link is invalid or has expired."]})
        user.set_password(ser.validated_data["password"])
        user.save()
        return Response({"detail": "Your password has been updated. You can sign in now."})


class GoogleLoginView(SocialLoginView):
    """Exchange a Google OAuth authorisation code for a session."""

    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    callback_url = f"{settings.FRONTEND_URL}/account/google"
    throttle_scope = "auth"

    def get_response(self):
        response = super().get_response()
        merge_guest_cart(self.request, self.user)
        response.delete_cookie(settings.CART_COOKIE_NAME)
        response.data = UserSerializer(self.user).data
        return response


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Address.objects.none()
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        first = not Address.objects.filter(user=self.request.user).exists()
        serializer.save(user=self.request.user, is_default=first or serializer.validated_data.get("is_default", False))
