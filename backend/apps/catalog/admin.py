from django.contrib import admin, messages
from django.db.models import Count, F, Sum
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from django.utils.text import slugify
from import_export import fields, resources
from import_export.admin import ImportExportModelAdmin
from import_export.widgets import ForeignKeyWidget
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, TabularInline
from unfold.contrib.filters.admin import ChoicesDropdownFilter, RelatedDropdownFilter
from unfold.contrib.import_export.forms import ExportForm, ImportForm
from unfold.decorators import action, display

from apps.core.exceptions import CommerceError
from apps.inventory.services import adjust_stock

from .models import Category, Collection, Product, ProductMedia, Variant, WishlistItem
from .tasks import generate_fabric_texture


def save_variant_with_stock_audit(variant: Variant, form, user) -> None:
    """Save a variant edited in the admin, routing any stock change through the
    inventory service so it is locked, validated and logged as a movement."""
    if variant.pk and "stock" in form.changed_data:
        new_stock = variant.stock
        variant.stock = form.initial.get("stock", variant.stock)
        variant.save()
        adjust_stock(variant.pk, new_stock, user=user, note="Edited in admin")
    else:
        variant.save()


class ProductResource(resources.ModelResource):
    category = fields.Field(attribute="category", column_name="category", widget=ForeignKeyWidget(Category, "slug"))
    primary_collection = fields.Field(
        attribute="primary_collection", column_name="collection", widget=ForeignKeyWidget(Collection, "slug")
    )

    class Meta:
        model = Product
        import_id_fields = ["slug"]
        fields = [
            "slug", "name", "subtitle", "description", "fabric_care", "category", "primary_collection", "fabric",
            "occasion", "tags", "price", "compare_at_price", "hsn_code", "gst_rate", "status", "shape_preset",
            "is_featured", "is_new", "is_bestseller", "is_top_pick", "in_wardrobe", "seo_title", "seo_description",
        ]
        skip_unchanged = True


class VariantResource(resources.ModelResource):
    product = fields.Field(attribute="product", column_name="product", widget=ForeignKeyWidget(Product, "slug"))

    class Meta:
        model = Variant
        import_id_fields = ["sku"]
        fields = ["sku", "product", "color_name", "color_hex", "size", "length", "price", "compare_at_price", "stock", "low_stock_threshold", "weight_grams", "is_active"]
        skip_unchanged = True


class VariantInline(TabularInline):
    model = Variant
    extra = 0
    fields = ["sku", "color_name", "color_hex", "size", "length", "price", "compare_at_price", "stock", "weight_grams", "is_active", "position"]
    ordering_field = "position"
    hide_ordering_field = True
    tab = True


class MediaInline(TabularInline):
    model = ProductMedia
    extra = 0
    fields = ["image", "preview", "alt_text", "color_name", "video_url", "position"]
    readonly_fields = ["preview"]
    ordering_field = "position"
    hide_ordering_field = True
    tab = True
    verbose_name_plural = "Images & video (drag to reorder)"

    @display(description="")
    def preview(self, obj):
        return format_html('<img src="{}" class="hh-thumb">', obj.image.url) if obj.image else ""


class LowStockFilter(admin.SimpleListFilter):
    title = "stock level"
    parameter_name = "stock_level"

    def lookups(self, request, model_admin):
        return [("out", "Sold out"), ("low", "Low stock"), ("ok", "In stock")]

    def queryset(self, request, queryset):
        available = F("stock") - F("reserved")
        qs = queryset.annotate(_avail=available)
        if self.value() == "out":
            return qs.filter(_avail__lte=0)
        if self.value() == "low":
            return qs.filter(_avail__gt=0, _avail__lte=F("low_stock_threshold"))
        if self.value() == "ok":
            return qs.filter(_avail__gt=F("low_stock_threshold"))
        return queryset


@admin.register(Product)
class ProductAdmin(SimpleHistoryAdmin, ImportExportModelAdmin, ModelAdmin):
    resource_classes = [ProductResource]
    import_form_class = ImportForm
    export_form_class = ExportForm

    list_display = ["thumb", "name", "primary_collection", "price_display", "stock_total", "state", "is_top_pick", "in_wardrobe", "is_new", "is_bestseller"]
    list_display_links = ["thumb", "name"]
    list_editable = ["is_top_pick", "in_wardrobe", "is_new", "is_bestseller"]
    list_filter = [
        ("status", ChoicesDropdownFilter), ("primary_collection", RelatedDropdownFilter),
        ("fabric", ChoicesDropdownFilter), "is_top_pick", "in_wardrobe", "is_featured", "is_new", "is_bestseller",
    ]
    list_filter_submit = True
    search_fields = ["name", "slug", "tags", "variants__sku"]
    list_per_page = 40
    show_full_result_count = False
    list_select_related = ["primary_collection"]
    prepopulated_fields = {"slug": ["name"]}
    autocomplete_fields = ["related_products", "collections"]
    readonly_fields = ["cutout_preview", "rating_average", "rating_count", "sales_count"]
    inlines = [VariantInline, MediaInline]
    save_on_top = True
    actions = ["make_active", "make_draft", "duplicate", "regenerate_cutouts"]
    actions_detail = ["duplicate_one", "regenerate_cutout_one"]

    fieldsets = [
        ("Product", {"classes": ["tab"], "fields": [
            "name", "slug", "subtitle", "description", "fabric_care", "category", "primary_collection",
            "collections", "fabric", "occasion", "tags",
        ]}),
        ("Pricing & tax", {"classes": ["tab"], "fields": ["price", "compare_at_price", "hsn_code", "gst_rate"]}),
        ("Visibility", {"classes": ["tab"], "fields": [
            "status", "publish_at", "is_featured", "is_new", "is_bestseller",
            ("is_top_pick", "top_pick_order"), ("in_wardrobe", "wardrobe_order", "wardrobe_placement"),
        ]}),
        ("Fabric in Motion (3D)", {"classes": ["tab"], "fields": [
            "shape_preset", "cutout_preview", "fabric_texture", "fabric_texture_locked",
        ], "description": "How this product appears in the 3D hero and wardrobe. The fabric type above sets how it moves."}),
        ("Related & SEO", {"classes": ["tab"], "fields": [
            "related_products", "seo_title", "seo_description", "rating_average", "rating_count", "sales_count",
        ]}),
    ]

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .annotate(_stock=Sum("variants__stock"), _variants=Count("variants"))
            .prefetch_related("media")
        )

    @display(description="")
    def thumb(self, obj):
        media = next((m for m in obj.media.all() if m.image), None)
        return format_html('<img src="{}" class="hh-thumb">', media.image.url) if media else ""

    @display(description="Price", ordering="price")
    def price_display(self, obj):
        if obj.compare_at_price and obj.compare_at_price > obj.price:
            return format_html("₹{} <s style='opacity:.5'>₹{}</s>", f"{obj.price:,.0f}", f"{obj.compare_at_price:,.0f}")
        return f"₹{obj.price:,.0f}"

    @display(description="Stock", ordering="_stock")
    def stock_total(self, obj):
        return f"{obj._stock or 0} in {obj._variants} variant(s)"

    @display(description="Status", ordering="status", label={"Active": "success", "Draft": "warning", "Archived": "danger", "Scheduled": "info"})
    def state(self, obj):
        if obj.status == Product.Status.ACTIVE and not obj.is_live:
            return "Scheduled"
        return obj.get_status_display()

    @display(description="Current cut-out")
    def cutout_preview(self, obj):
        if obj and obj.fabric_texture:
            return format_html('<img src="{}" class="hh-cutout">', obj.fabric_texture.url)
        return "Generated automatically after you add the first image and save."

    def save_formset(self, request, form, formset, change):
        if formset.model is not Variant:
            return super().save_formset(request, form, formset, change)
        instances = formset.save(commit=False)
        for obj in formset.deleted_objects:
            obj.delete()
        by_instance = {f.instance: f for f in formset.forms}
        for variant in instances:
            try:
                save_variant_with_stock_audit(variant, by_instance[variant], request.user)
            except CommerceError as exc:
                messages.error(request, f"{variant.sku}: {exc.detail}")
        formset.save_m2m()

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        product = form.instance
        if product.primary_collection_id:
            product.collections.add(product.primary_collection_id)
        if not product.fabric_texture:
            generate_fabric_texture.delay(product.pk)

    def _duplicate(self, product: Product) -> Product:
        variants, media = list(product.variants.all()), list(product.media.all())
        collections = list(product.collections.all())
        base = slugify(f"{product.name} copy")
        slug, n = base, 2
        while Product.objects.filter(slug=slug).exists():
            slug, n = f"{base}-{n}", n + 1
        product.pk, product.id = None, None
        product.name, product.slug, product.status = f"{product.name} (copy)", slug, Product.Status.DRAFT
        product.is_top_pick = product.in_wardrobe = False
        product.sales_count = product.rating_count = 0
        product.rating_average = 0
        product.save()
        product.collections.set(collections)
        for v in variants:
            v.pk, v.id, v.product, v.reserved, v.stock = None, None, product, 0, 0
            v.sku = f"{v.sku}-COPY{product.pk}"
            v.save()
        for m in media:
            m.pk, m.id, m.product = None, None, product
            m.save()
        return product

    @action(description="Duplicate selected products")
    def duplicate(self, request, queryset):
        for product in queryset:
            self._duplicate(product)
        self.message_user(request, f"Duplicated {queryset.count()} product(s) as drafts with zero stock.")

    @action(description="Duplicate", url_path="duplicate")
    def duplicate_one(self, request, object_id):
        copy = self._duplicate(Product.objects.get(pk=object_id))
        self.message_user(request, "Duplicated as a draft with zero stock.")
        return redirect(reverse("admin:catalog_product_change", args=[copy.pk]))

    @action(description="Regenerate 3D cut-out", url_path="regenerate-cutout")
    def regenerate_cutout_one(self, request, object_id):
        ok = generate_fabric_texture(int(object_id), force=True)
        self.message_user(
            request, "Cut-out regenerated." if ok else "Could not regenerate (no image, or 'Keep my uploaded cut-out' is ticked).",
            messages.SUCCESS if ok else messages.WARNING,
        )
        return redirect(reverse("admin:catalog_product_change", args=[object_id]))

    @action(description="Regenerate 3D cut-outs")
    def regenerate_cutouts(self, request, queryset):
        for pk in queryset.values_list("pk", flat=True):
            generate_fabric_texture.delay(pk, force=True)
        self.message_user(request, "Cut-outs are being regenerated.")

    @action(description="Set status: Active")
    def make_active(self, request, queryset):
        self.message_user(request, f"{queryset.update(status=Product.Status.ACTIVE)} product(s) are now active.")

    @action(description="Set status: Draft")
    def make_draft(self, request, queryset):
        self.message_user(request, f"{queryset.update(status=Product.Status.DRAFT)} product(s) moved to draft.")


@admin.register(Variant)
class InventoryAdmin(SimpleHistoryAdmin, ImportExportModelAdmin, ModelAdmin):
    """Inventory: every variant with editable stock. Changes are logged as movements."""

    resource_classes = [VariantResource]
    import_form_class = ImportForm
    export_form_class = ExportForm

    list_display = ["sku", "product", "option", "stock", "reserved", "available_display", "low_stock_threshold", "level", "is_active"]
    list_editable = ["stock", "low_stock_threshold", "is_active"]
    list_filter = [LowStockFilter, ("product__primary_collection", RelatedDropdownFilter), "is_active"]
    list_filter_submit = True
    search_fields = ["sku", "product__name", "color_name"]
    list_select_related = ["product"]
    list_per_page = 60
    show_full_result_count = False
    autocomplete_fields = ["product"]
    readonly_fields = ["reserved"]

    @display(description="Option")
    def option(self, obj):
        swatch = format_html('<span class="hh-swatch" style="background:{}"></span>', obj.color_hex) if obj.color_hex else ""
        return format_html("{}{}", swatch, obj.label or "—")

    @display(description="Available")
    def available_display(self, obj):
        return obj.available

    @display(description="Level", label={"Sold out": "danger", "Low": "warning", "OK": "success"})
    def level(self, obj):
        if obj.available <= 0:
            return "Sold out"
        return "Low" if obj.is_low_stock else "OK"

    def save_model(self, request, obj, form, change):
        try:
            save_variant_with_stock_audit(obj, form, request.user)
        except CommerceError as exc:
            messages.error(request, f"{obj.sku}: {exc.detail}")


@admin.register(Collection)
class CollectionAdmin(ModelAdmin):
    list_display = ["name", "slug", "kind", "product_total", "order", "is_featured", "is_active"]
    list_editable = ["order", "is_featured", "is_active"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ["name"]}
    fieldsets = [
        (None, {"fields": ["name", "slug", "tagline", "description", "image", "accent_color", "order", "is_featured", "is_active"]}),
        ("Automatic rules", {"fields": ["is_rule_based", "rule_category", "rule_fabric", "rule_tag", "rule_max_price", "rule_on_sale"],
                             "description": "Turn on to include every product matching all the rules you fill in, on top of products assigned by hand."}),
        ("SEO", {"classes": ["collapse"], "fields": ["seo_title", "seo_description"]}),
    ]

    @display(description="Type", label={"Rules": "info", "Manual": "success"})
    def kind(self, obj):
        return "Rules" if obj.is_rule_based else "Manual"

    @display(description="Products")
    def product_total(self, obj):
        return Product.objects.filter(obj.product_filter()).distinct().count()


@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ["name", "slug", "order"]
    list_editable = ["order"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(WishlistItem)
class WishlistItemAdmin(ModelAdmin):
    list_display = ["user", "product", "created_at"]
    list_select_related = ["user", "product"]
    search_fields = ["user__email", "product__name"]
