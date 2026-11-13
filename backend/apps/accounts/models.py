import secrets
from datetime import timedelta

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self._create(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField("email address", unique=True)
    phone = models.CharField(max_length=20, blank=True)
    accepts_marketing = models.BooleanField(default=False)
    tags = models.CharField(max_length=200, blank=True, help_text="Comma separated, e.g. vip, wholesale.")
    notes = models.TextField(blank=True, help_text="Internal notes. Never shown to the customer.")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []
    objects = UserManager()

    class Meta:
        verbose_name = "customer"
        verbose_name_plural = "customers"

    def __str__(self):
        return self.email

    @property
    def full_name(self) -> str:
        return self.get_full_name() or self.email.split("@")[0]


class Address(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    line1 = models.CharField("address line 1", max_length=200)
    line2 = models.CharField("address line 2", max_length=200, blank=True)
    landmark = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    pincode = models.CharField(max_length=10)
    country = models.CharField(max_length=2, default="IN")
    is_default = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_default", "-updated_at"]
        verbose_name_plural = "addresses"

    def __str__(self):
        return f"{self.full_name}, {self.city} {self.pincode}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            Address.objects.filter(user=self.user).exclude(pk=self.pk).update(is_default=False)


class EmailOTP(models.Model):
    """One-time login codes. Only a hash of the code is stored."""

    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)

    MAX_ATTEMPTS = 5

    @classmethod
    def issue(cls, email: str) -> str:
        email = email.lower().strip()
        cls.objects.filter(email=email, used=False).update(used=True)
        code = f"{secrets.randbelow(10**6):06d}"
        cls.objects.create(
            email=email, code_hash=make_password(code), expires_at=timezone.now() + timedelta(minutes=10)
        )
        return code

    @classmethod
    def verify(cls, email: str, code: str) -> bool:
        otp = cls.objects.filter(email=email.lower().strip(), used=False).order_by("-created_at").first()
        if not otp or otp.expires_at < timezone.now() or otp.attempts >= cls.MAX_ATTEMPTS:
            return False
        if not check_password(code, otp.code_hash):
            cls.objects.filter(pk=otp.pk).update(attempts=models.F("attempts") + 1)
            return False
        otp.used = True
        otp.save(update_fields=["used"])
        return True
