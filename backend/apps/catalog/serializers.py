from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.utils import media_url

from .models import Category, Collection, Product, ProductMedia, Variant, WishlistItem

# How Fabric in Motion describes each fabric on the product page.
FABRIC_FEEL = {
    "silk": "fluid drape", "chiffon": "airy flutter", "georgette": "light and airy", "modal": "soft fall",
    "viscose": "soft fall", "jersey": "easy stretch", "crepe": "elegant swing", "nida": "weighted flow",
}


class SwatchSerializer(serializers.Serializer):
    name = serializers.CharField()
    hex = serializers.CharField()


class CollectionRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ["slug", "name"]


class CollectionSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Collection
        fields = [
            "slug", "name", "tagline", "description", "image", "accent_color", "is_featured",
            "product_count", "seo_title", "seo_description",
        ]

    def get_image(self, obj) -> str | None:
        return media_url(obj.image)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["slug", "name", "description", "size_guide"]


class VariantSerializer(serializers.ModelSerializer):
    price = serializers.DecimalField(source="effective_price", max_digits=10, decimal_places=2)
    compare_at_price = serializers.DecimalField(
        source="effective_compare_at", max_digits=10, decimal_places=2, allow_null=True
    )
    available = serializers.SerializerMethodField()
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Variant
        fields = [
            "id", "sku", "color_name", "color_hex", "size", "length", "label", "price", "compare_at_price",
            "available", "is_low_stock",
        ]

    def get_available(self, obj) -> int:
        # Never reveal exact stock beyond what urgency messaging needs.
        return min(obj.available, 10)


class MediaSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductMedia
        fields = ["id", "kind", "image", "video_url", "alt_text", "color_name"]

    def get_image(self, obj) -> str | None:
        return media_url(obj.image)


class ProductCardSerializer(serializers.ModelSerializer):
    """Everything a product card, quick view and the 3D sections need."""

    collection = CollectionRefSerializer(source="primary_collection", read_only=True)
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    fabric_label = serializers.CharField(source="get_fabric_display", read_only=True)
    fabric_feel = serializers.SerializerMethodField()
    media = MediaSerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()
    swatches = serializers.SerializerMethodField()
    fabric_texture = serializers.SerializerMethodField()
    discount_percent = serializers.IntegerField(read_only=True)
    in_stock = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    is_new = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "slug", "name", "subtitle", "price", "compare_at_price", "discount_percent", "collection",
            "category", "fabric", "fabric_label", "fabric_feel", "occasion", "shape_preset", "fabric_texture",
            "wardrobe_placement", "media", "variants", "swatches", "in_stock", "is_low_stock", "is_new",
            "is_bestseller", "is_featured", "rating_average", "rating_count",
        ]

    def _variants(self, obj) -> list[Variant]:
        return [v for v in obj.variants.all() if v.is_active]

    @extend_schema_field(VariantSerializer(many=True))
    def get_variants(self, obj):
        return VariantSerializer(self._variants(obj), many=True).data

    @extend_schema_field(SwatchSerializer(many=True))
    def get_swatches(self, obj):
        seen, out = set(), []
        for v in self._variants(obj):
            if v.color_name and v.color_name not in seen:
                seen.add(v.color_name)
                out.append({"name": v.color_name, "hex": v.color_hex or "#C8A882"})
        return out

    def get_fabric_texture(self, obj) -> str | None:
        return media_url(obj.fabric_texture)

    def get_fabric_feel(self, obj) -> str:
        return FABRIC_FEEL.get(obj.fabric, "soft drape")

    def get_in_stock(self, obj) -> bool:
        return any(v.available > 0 for v in self._variants(obj))

    def get_is_low_stock(self, obj) -> bool:
        total = sum(v.available for v in self._variants(obj))
        return 0 < total <= 5

    def get_is_new(self, obj) -> bool:
        return obj.is_new or obj.created_at > timezone.now() - timedelta(days=21)


class ProductDetailSerializer(ProductCardSerializer):
    occasion_label = serializers.CharField(source="get_occasion_display", read_only=True)
    tags = serializers.ListField(source="tag_list", child=serializers.CharField(), read_only=True)
    size_guide = serializers.CharField(source="category.size_guide", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    related = serializers.SerializerMethodField()
    complete_the_look = serializers.SerializerMethodField()

    class Meta(ProductCardSerializer.Meta):
        fields = ProductCardSerializer.Meta.fields + [
            "description", "fabric_care", "occasion_label", "tags", "size_guide", "category_name",
            "seo_title", "seo_description", "related", "complete_the_look",
        ]

    @extend_schema_field(ProductCardSerializer(many=True))
    def get_complete_the_look(self, obj):
        qs = obj.related_products.live().for_listing()[:4]
        return ProductCardSerializer(qs, many=True).data

    @extend_schema_field(ProductCardSerializer(many=True))
    def get_related(self, obj):
        qs = (
            Product.objects.live().for_listing()
            .filter(primary_collection_id=obj.primary_collection_id)
            .exclude(pk=obj.pk)
            .order_by("-sales_count")[:8]
        )
        return ProductCardSerializer(qs, many=True).data


class FacetOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()
    hex = serializers.CharField(required=False)


class FacetsSerializer(serializers.Serializer):
    colors = FacetOptionSerializer(many=True)
    sizes = FacetOptionSerializer(many=True)
    fabrics = FacetOptionSerializer(many=True)
    occasions = FacetOptionSerializer(many=True)
    categories = FacetOptionSerializer(many=True)
    min_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    max_price = serializers.DecimalField(max_digits=10, decimal_places=2)


class SuggestSerializer(serializers.Serializer):
    products = ProductCardSerializer(many=True)
    collections = CollectionRefSerializer(many=True)


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductCardSerializer(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ["id", "product", "created_at"]


class WishlistAddSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()


class WishlistSyncSerializer(serializers.Serializer):
    product_ids = serializers.ListField(child=serializers.IntegerField(), max_length=200)
