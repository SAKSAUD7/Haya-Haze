from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from django.utils.text import slugify
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel


class Fabric(models.TextChoices):
    SILK = "silk", "Silk"
    CHIFFON = "chiffon", "Chiffon"
    GEORGETTE = "georgette", "Georgette"
    MODAL = "modal", "Modal"
    VISCOSE = "viscose", "Viscose"
    JERSEY = "jersey", "Jersey"
    CREPE = "crepe", "Crepe"
    NIDA = "nida", "Nida"


class Occasion(models.TextChoices):
    EVERYDAY = "everyday", "Everyday"
    WORK = "work", "Work"
    FESTIVE = "festive", "Festive & Eid"
    WEDDING = "wedding", "Wedding"
    TRAVEL = "travel", "Travel"
    PRAYER = "prayer", "Prayer"


class ShapePreset(models.TextChoices):
    """How Fabric in Motion renders the product (see CONTEXT.md, section 2.4)."""

    FLAT = "flat", "Flat floating panel"
    HANGING = "hanging-garment", "Hanging garment (abaya, dress)"
    DRAPED = "draped-over-bar", "Draped over a bar (hijab, scarf)"
    FOLDED = "folded", "Folded on a shelf"


class Category(TimeStampedModel):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    size_guide = models.TextField(blank=True, help_text="Shown in the size guide modal. Plain text or simple HTML table.")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Collection(TimeStampedModel):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    tagline = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="collections/", blank=True)
    accent_color = models.CharField(max_length=7, default="#C8A882")
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=True, help_text="Show in the home page collection grid and menus.")
    order = models.PositiveSmallIntegerField(default=0)
    # Rule-based collections: products matching every filled rule are included
    # automatically, in addition to products assigned by hand.
    is_rule_based = models.BooleanField(default=False)
    rule_category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    rule_fabric = models.CharField(max_length=20, choices=Fabric.choices, blank=True)
    rule_tag = models.CharField(max_length=40, blank=True)
    rule_max_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rule_on_sale = models.BooleanField(default=False)
    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=170, blank=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name

    def product_filter(self) -> Q:
        q = Q(collections=self)
        if self.is_rule_based:
            rule = Q()
            if self.rule_category_id:
                rule &= Q(category_id=self.rule_category_id)
            if self.rule_fabric:
                rule &= Q(fabric=self.rule_fabric)
            if self.rule_tag:
                rule &= Q(tags__icontains=self.rule_tag)
            if self.rule_max_price is not None:
                rule &= Q(price__lte=self.rule_max_price)
            if self.rule_on_sale:
                rule &= Q(compare_at_price__gt=F("price"))
            if rule:
                q |= rule
        return q


class ProductQuerySet(models.QuerySet):
    def live(self):
        now = timezone.now()
        return self.filter(status=Product.Status.ACTIVE).filter(Q(publish_at__isnull=True) | Q(publish_at__lte=now))

    def for_listing(self):
        return self.select_related("category", "primary_collection").prefetch_related("media", "variants")


class Product(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    class WardrobePlacement(models.TextChoices):
        RAIL = "rail", "Hanging on the rail"
        SHELF = "shelf", "Folded on a shelf"

    name = models.CharField(max_length=140)
    slug = models.SlugField(max_length=160, unique=True)
    subtitle = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)
    fabric_care = models.TextField("Fabric & care", blank=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    primary_collection = models.ForeignKey(
        Collection, null=True, blank=True, on_delete=models.SET_NULL, related_name="primary_products"
    )
    collections = models.ManyToManyField(Collection, blank=True, related_name="products")
    fabric = models.CharField(max_length=20, choices=Fabric.choices, default=Fabric.CHIFFON, db_index=True)
    occasion = models.CharField(max_length=20, choices=Occasion.choices, default=Occasion.EVERYDAY, db_index=True)
    tags = models.CharField(max_length=250, blank=True, help_text="Comma separated.")

    # Prices are the default for all variants; a variant may override them.
    price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    hsn_code = models.CharField("HSN code", max_length=12, blank=True)
    gst_rate = models.DecimalField("GST %", max_digits=5, decimal_places=2, null=True, blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, db_index=True)
    publish_at = models.DateTimeField(null=True, blank=True, help_text="Leave empty to publish as soon as status is Active.")
    is_featured = models.BooleanField(default=False, db_index=True)
    is_new = models.BooleanField("New arrival", default=False, db_index=True)
    is_bestseller = models.BooleanField(default=False, db_index=True)
    is_top_pick = models.BooleanField("Top Pick (3D hero)", default=False, db_index=True)
    top_pick_order = models.PositiveSmallIntegerField(default=0)
    in_wardrobe = models.BooleanField("In Wardrobe (3D)", default=False, db_index=True)
    wardrobe_order = models.PositiveSmallIntegerField(default=0)
    wardrobe_placement = models.CharField(
        max_length=6, choices=WardrobePlacement.choices, default=WardrobePlacement.RAIL
    )

    # Fabric in Motion
    shape_preset = models.CharField(max_length=20, choices=ShapePreset.choices, default=ShapePreset.DRAPED)
    fabric_texture = models.ImageField(
        upload_to="fabric/", blank=True,
        help_text="Transparent cut-out used by the 3D sections. Generated automatically from the first image; upload to replace.",
    )
    fabric_texture_locked = models.BooleanField(
        "Keep my uploaded cut-out", default=False, help_text="Tick to stop automatic regeneration."
    )

    related_products = models.ManyToManyField("self", blank=True, symmetrical=False, related_name="+")
    seo_title = models.CharField(max_length=70, blank=True)
    seo_description = models.CharField(max_length=170, blank=True)
    rating_average = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0"))
    rating_count = models.PositiveIntegerField(default=0)
    sales_count = models.PositiveIntegerField(default=0)

    history = HistoricalRecords(excluded_fields=["rating_average", "rating_count", "sales_count"])
    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"]), models.Index(fields=["status", "price"])]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:160]
        super().save(*args, **kwargs)

    @property
    def is_live(self) -> bool:
        return self.status == self.Status.ACTIVE and (self.publish_at is None or self.publish_at <= timezone.now())

    @property
    def tag_list(self) -> list[str]:
        return [t.strip() for t in self.tags.split(",") if t.strip()]

    @property
    def discount_percent(self) -> int:
        if self.compare_at_price and self.compare_at_price > self.price:
            return int(round((1 - self.price / self.compare_at_price) * 100))
        return 0


class Variant(TimeStampedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField("SKU", max_length=60, unique=True)
    color_name = models.CharField(max_length=40, blank=True)
    color_hex = models.CharField(max_length=7, blank=True)
    size = models.CharField(max_length=12, blank=True, help_text="S, M, L, XL, XXL or Free Size.")
    length = models.CharField(max_length=6, blank=True, help_text='Abaya length in inches, e.g. 54.')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Leave empty to use the product price.")
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0, editable=False)
    low_stock_threshold = models.PositiveSmallIntegerField(default=5)
    weight_grams = models.PositiveIntegerField(default=150)
    is_active = models.BooleanField(default=True)
    position = models.PositiveSmallIntegerField(default=0)

    history = HistoricalRecords(excluded_fields=["reserved"])

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.CheckConstraint(condition=Q(reserved__lte=F("stock")), name="variant_reserved_lte_stock"),
        ]

    def __str__(self):
        return f"{self.product.name} — {self.label}" if self.label else self.product.name

    @property
    def label(self) -> str:
        parts = [self.color_name, self.size, f'{self.length}"' if self.length else ""]
        return " / ".join(p for p in parts if p)

    @property
    def available(self) -> int:
        return max(self.stock - self.reserved, 0)

    @property
    def effective_price(self) -> Decimal:
        return self.price if self.price is not None else self.product.price

    @property
    def effective_compare_at(self) -> Decimal | None:
        return self.compare_at_price if self.compare_at_price is not None else self.product.compare_at_price

    @property
    def is_low_stock(self) -> bool:
        return 0 < self.available <= self.low_stock_threshold


class ProductMedia(TimeStampedModel):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="media")
    kind = models.CharField(max_length=5, choices=Kind.choices, default=Kind.IMAGE)
    image = models.ImageField(upload_to="products/", blank=True)
    video_url = models.URLField(blank=True)
    alt_text = models.CharField(max_length=160, blank=True)
    color_name = models.CharField(max_length=40, blank=True, help_text="Show this image when the colour is selected.")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        verbose_name_plural = "product media"

    def __str__(self):
        return f"{self.product.name} #{self.position}"


class WishlistItem(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist_items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="wishlisted_by")

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "product"], name="unique_wishlist_item")]

    def __str__(self):
        return f"{self.user} ♥ {self.product}"
