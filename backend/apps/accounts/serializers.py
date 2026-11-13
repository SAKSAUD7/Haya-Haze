import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Address, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "full_name", "phone", "accepts_marketing", "date_joined"]
        read_only_fields = ["id", "email", "date_joined"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60, allow_blank=True, required=False, default="")
    accepts_marketing = serializers.BooleanField(default=False)

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists. Try signing in.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value


class OTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\d{6}$")


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_password(self, value):
        validate_password(value)
        return value


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "full_name", "phone", "line1", "line2", "landmark", "city", "state", "pincode", "country", "is_default"]

    def validate_pincode(self, value):
        if not re.match(r"^[1-9]\d{5}$", value.strip()):
            raise serializers.ValidationError("Enter a valid 6-digit pincode.")
        return value.strip()

    def validate_phone(self, value):
        digits = re.sub(r"[\s-]", "", value)
        if not re.match(r"^(\+?91)?[6-9]\d{9}$", digits):
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return digits
