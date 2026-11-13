from decimal import Decimal

from django.core.cache import cache
from django.db import models
from simple_history.models import HistoricalRecords


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SiteSettings(TimeStampedModel):
    """Single-row store configuration, edited in the admin under Store settings."""

    CACHE_KEY = "core:site-settings"

    class WoodTone(models.TextChoices):
        WALNUT = "walnut", "Walnut"
        ESPRESSO = "espresso", "Espresso"
        IVORY = "ivory", "Ivory lacquer"

    store_name = models.CharField(max_length=80, default="Haya & Haze")
    tagline = models.CharField(max_length=160, default="Draped in Grace. Defined by You.")
    logo_light = models.FileField(upload_to="brand/", blank=True, help_text="Logo for light backgrounds (SVG or PNG).")
    logo_dark = models.FileField(upload_to="brand/", blank=True, help_text="Logo for dark backgrounds (SVG or PNG).")
    contact_email = models.EmailField(default="hello@hayaandhaze.com")
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    gstin = models.CharField("GSTIN", max_length=20, blank=True)

    whatsapp_number = models.CharField(
        max_length=20, blank=True, help_text="With country code, digits only, e.g. 919876543210."
    )
    whatsapp_message = models.CharField(max_length=200, default="Salaam! I have a question about Haya & Haze.")
    instagram_url = models.URLField(default="https://instagram.com/hayaandhaze")
    tiktok_url = models.URLField(default="https://tiktok.com/@hayaandhaze")
    pinterest_url = models.URLField(default="https://pinterest.com/hayaandhaze")

    # Shipping and COD
    free_shipping_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1499"))
    standard_shipping_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("79"))
    express_shipping_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("149"))
    standard_delivery_days = models.CharField(max_length=20, default="5-7")
    express_delivery_days = models.CharField(max_length=20, default="2-3")
    ship_to_unlisted_pincodes = models.BooleanField(
        default=True, help_text="Deliver to pincodes that are not in the serviceable list."
    )
    cod_enabled = models.BooleanField("COD enabled", default=True)
    cod_fee = models.DecimalField("COD fee", max_digits=10, decimal_places=2, default=Decimal("49"))
    cod_min_order = models.DecimalField("COD minimum order", max_digits=10, decimal_places=2, default=Decimal("0"))
    cod_max_order = models.DecimalField("COD maximum order", max_digits=10, decimal_places=2, default=Decimal("10000"))
    gift_wrap_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("49"))

    # Tax
    prices_include_gst = models.BooleanField("Prices include GST", default=True)
    default_gst_rate = models.DecimalField("Default GST %", max_digits=5, decimal_places=2, default=Decimal("5"))
    default_hsn_code = models.CharField("Default HSN code", max_length=12, default="6214")

    # Home hero / wardrobe
    hero_headline = models.TextField(
        default="Comfortable enough to forget.\nBeautiful enough to remember.\nThis is Haya & Haze."
    )
    hero_subtext = models.CharField(max_length=200, default="Hijabs and modest wear, made to move with you.")
    wardrobe_enabled = models.BooleanField(default=True)
    wardrobe_title = models.CharField(max_length=80, default="The Haya Wardrobe")
    wardrobe_subtitle = models.CharField(
        max_length=200, default="Step inside. Slide the rail, lift a piece, make it yours."
    )
    wardrobe_wood_tone = models.CharField(max_length=12, choices=WoodTone.choices, default=WoodTone.ESPRESSO)
    wardrobe_light_warmth = models.PositiveSmallIntegerField(
        default=70, help_text="0 = cool daylight, 100 = warm candlelight."
    )

    # Marketing
    popup_enabled = models.BooleanField("Welcome popup enabled", default=True)
    popup_title = models.CharField(max_length=80, default="A little welcome gift")
    popup_text = models.CharField(
        max_length=200, default="Join the Haya & Haze family and take 10% off your first order."
    )
    popup_coupon_code = models.CharField(max_length=30, default="WELCOME10")
    ga4_measurement_id = models.CharField("GA4 measurement ID", max_length=30, blank=True)
    meta_pixel_id = models.CharField(max_length=30, blank=True)
    seo_title = models.CharField("Default SEO title", max_length=70, default="Haya & Haze — Hijabs & Modest Wear")
    seo_description = models.CharField(
        "Default SEO description",
        max_length=170,
        default="Elegant hijabs, scarves and abayas for every woman and every occasion. Draped in Grace. Defined by You.",
    )

    history = HistoricalRecords()

    class Meta:
        verbose_name = "Store settings"
        verbose_name_plural = "Store settings"

    def __str__(self):
        return self.store_name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete(self.CACHE_KEY)

    def delete(self, *args, **kwargs):  # the singleton is never deleted
        return 0, {}

    @classmethod
    def load(cls) -> "SiteSettings":
        obj = cache.get(cls.CACHE_KEY)
        if obj is None:
            obj, _ = cls.objects.get_or_create(pk=1)
            cache.set(cls.CACHE_KEY, obj, 300)
        return obj


class Announcement(TimeStampedModel):
    text = models.CharField(max_length=140)
    link = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text


class ContactMessage(TimeStampedModel):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=160, blank=True)
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    admin_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}: {self.subject or self.message[:40]}"
