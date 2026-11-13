import django_filters
from django.db.models import Count, F, Max, Min, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Collection, Fabric, Occasion, Product, Variant, WishlistItem
from .search import search_products
from .serializers import (
    CategorySerializer,
    CollectionSerializer,
    FacetsSerializer,
    ProductCardSerializer,
    ProductDetailSerializer,
    SuggestSerializer,
    WishlistAddSerializer,
    WishlistItemSerializer,
    WishlistSyncSerializer,
)

ORDERINGS = {
    "featured": ["-is_featured", "-sales_count", "-created_at"],
    "newest": ["-created_at"],
    "price_asc": ["price", "id"],
    "price_desc": ["-price", "id"],
    "bestselling": ["-sales_count", "-created_at"],
    "rating": ["-rating_average", "-rating_count"],
}


class CsvFilter(django_filters.BaseInFilter, django_filters.CharFilter):
    pass


class ProductFilter(django_filters.FilterSet):
    collection = django_filters.CharFilter(method="by_collection")
    category = CsvFilter(field_name="category__slug")
    fabric = CsvFilter(field_name="fabric")
    occasion = CsvFilter(field_name="occasion")
    color = CsvFilter(method="by_color")
    size = CsvFilter(method="by_size")
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    in_stock = django_filters.BooleanFilter(method="by_stock")
    on_sale = django_filters.BooleanFilter(method="by_sale")
    top_pick = django_filters.BooleanFilter(field_name="is_top_pick")
    in_wardrobe = django_filters.BooleanFilter(field_name="in_wardrobe")
    is_new = django_filters.BooleanFilter(field_name="is_new")
    is_bestseller = django_filters.BooleanFilter(field_name="is_bestseller")
    is_featured = django_filters.BooleanFilter(field_name="is_featured")
    ids = CsvFilter(field_name="id")
    q = django_filters.CharFilter(method="by_search")
    sort = django_filters.ChoiceFilter(choices=[(k, k) for k in ORDERINGS], method="by_sort")

    class Meta:
        model = Product
        fields: list[str] = []

    def by_collection(self, qs, name, value):
        collection = Collection.objects.filter(slug=value, is_active=True).first()
        return qs.filter(collection.product_filter()).distinct() if collection else qs.none()

    def by_color(self, qs, name, value):
        return qs.filter(variants__color_name__in=value, variants__is_active=True).distinct()

    def by_size(self, qs, name, value):
        return qs.filter(variants__size__in=value, variants__is_active=True).distinct()

    def by_stock(self, qs, name, value):
        cond = Q(variants__is_active=True, variants__stock__gt=F("variants__reserved"))
        return qs.filter(cond).distinct() if value else qs

    def by_sale(self, qs, name, value):
        return qs.filter(compare_at_price__gt=F("price")) if value else qs

    def by_search(self, qs, name, value):
        return search_products(qs, value)

    def by_sort(self, qs, name, value):
        return qs.order_by(*ORDERINGS[value])


class ProductListView(generics.ListAPIView):
    """Products with filters, search, sorting and pagination."""

    serializer_class = ProductCardSerializer
    filterset_class = ProductFilter

    def get_queryset(self):
        qs = Product.objects.live().for_listing()
        params = self.request.query_params
        if params.get("top_pick") in ("true", "1"):
            return qs.order_by("top_pick_order", "id")
        if params.get("in_wardrobe") in ("true", "1"):
            return qs.order_by("wardrobe_order", "id")
        if not params.get("sort") and not params.get("q"):
            return qs.order_by(*ORDERINGS["featured"])
        return qs


class ProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Product.objects.live().for_listing()


class FacetsView(APIView):
    """Filter options (with counts) for a collection or a search."""

    @extend_schema(
        parameters=[OpenApiParameter("collection", str), OpenApiParameter("q", str)],
        responses=FacetsSerializer,
    )
    def get(self, request):
        qs = Product.objects.live()
        slug = request.query_params.get("collection")
        if slug:
            collection = Collection.objects.filter(slug=slug, is_active=True).first()
            qs = qs.filter(collection.product_filter()).distinct() if collection else qs.none()
        if request.query_params.get("q"):
            qs = search_products(qs, request.query_params["q"])
        ids = list(qs.values_list("id", flat=True))
        products = Product.objects.filter(id__in=ids)
        variants = Variant.objects.filter(product_id__in=ids, is_active=True)

        colors = (
            variants.exclude(color_name="").values("color_name", "color_hex")
            .annotate(count=Count("product", distinct=True)).order_by("color_name")
        )
        size_order = {s: i for i, s in enumerate(["Free Size", "XS", "S", "M", "L", "XL", "XXL"])}
        sizes = sorted(
            variants.exclude(size="").values("size").annotate(count=Count("product", distinct=True)),
            key=lambda r: size_order.get(r["size"], 99),
        )

        def counted(field, choices):
            labels = dict(choices)
            rows = products.values(field).annotate(count=Count("id")).order_by("-count")
            return [{"value": r[field], "label": labels.get(r[field], r[field]), "count": r["count"]} for r in rows]

        cats = products.values("category__slug", "category__name").annotate(count=Count("id")).order_by("category__name")
        price = products.aggregate(lo=Min("price"), hi=Max("price"))
        return Response({
            "colors": [
                {"value": c["color_name"], "label": c["color_name"], "hex": c["color_hex"] or "#C8A882", "count": c["count"]}
                for c in colors
            ],
            "sizes": [{"value": s["size"], "label": s["size"], "count": s["count"]} for s in sizes],
            "fabrics": counted("fabric", Fabric.choices),
            "occasions": counted("occasion", Occasion.choices),
            "categories": [
                {"value": c["category__slug"], "label": c["category__name"], "count": c["count"]} for c in cats
            ],
            "min_price": price["lo"] or 0,
            "max_price": price["hi"] or 0,
        })


class SuggestView(APIView):
    """Predictive search for the header search box."""

    @extend_schema(parameters=[OpenApiParameter("q", str, required=True)], responses=SuggestSerializer)
    def get(self, request):
        term = request.query_params.get("q", "").strip()
        if len(term) < 2:
            return Response({"products": [], "collections": []})
        products = search_products(Product.objects.live().for_listing(), term)[:6]
        collections = Collection.objects.filter(is_active=True, name__icontains=term)[:3]
        return Response(SuggestSerializer({"products": products, "collections": collections}).data)


class CollectionListView(generics.ListAPIView):
    serializer_class = CollectionSerializer
    pagination_class = None

    def get_queryset(self):
        live = Q(products__status=Product.Status.ACTIVE)
        return Collection.objects.filter(is_active=True).annotate(product_count=Count("products", filter=live, distinct=True))


class CollectionDetailView(generics.RetrieveAPIView):
    serializer_class = CollectionSerializer
    lookup_field = "slug"
    queryset = Collection.objects.filter(is_active=True)


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    pagination_class = None
    queryset = Category.objects.all()


class WishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _items(self, user):
        return (
            WishlistItem.objects.filter(user=user, product__status=Product.Status.ACTIVE)
            .select_related("product__category", "product__primary_collection")
            .prefetch_related("product__media", "product__variants")
        )

    @extend_schema(responses=WishlistItemSerializer(many=True))
    def get(self, request):
        return Response(WishlistItemSerializer(self._items(request.user), many=True).data)

    @extend_schema(request=WishlistAddSerializer, responses=WishlistItemSerializer(many=True))
    def post(self, request):
        ser = WishlistAddSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        product = generics.get_object_or_404(Product.objects.live(), pk=ser.validated_data["product_id"])
        WishlistItem.objects.get_or_create(user=request.user, product=product)
        return Response(WishlistItemSerializer(self._items(request.user), many=True).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=WishlistSyncSerializer, responses=WishlistItemSerializer(many=True))
    def put(self, request):
        """Merge a guest's locally saved wishlist into the account after login."""
        ser = WishlistSyncSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        for product in Product.objects.live().filter(pk__in=ser.validated_data["product_ids"]):
            WishlistItem.objects.get_or_create(user=request.user, product=product)
        return Response(WishlistItemSerializer(self._items(request.user), many=True).data)


class WishlistItemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, product_id: int):
        WishlistItem.objects.filter(user=request.user, product_id=product_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
