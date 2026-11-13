from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework import generics, parsers, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.core.utils import media_url
from apps.orders.models import Order, OrderItem

from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id", "name", "location", "rating", "title", "body", "photo", "is_verified_buyer", "admin_reply",
            "created_at", "product_name", "product_slug",
        ]

    def get_photo(self, obj) -> str | None:
        return media_url(obj.photo)


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["name", "location", "rating", "title", "body", "photo"]
        extra_kwargs = {"photo": {"required": False}}

    def validate_photo(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Please upload a photo under 5 MB.")
        return value


class ReviewSummarySerializer(serializers.Serializer):
    average = serializers.DecimalField(max_digits=3, decimal_places=2)
    count = serializers.IntegerField()
    breakdown = serializers.DictField(child=serializers.IntegerField())
    reviews = ReviewSerializer(many=True)


class ProductReviewsView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_throttles(self):
        self.throttle_scope = "forms" if self.request.method == "POST" else None
        return super().get_throttles()

    @extend_schema(responses=ReviewSummarySerializer)
    def get(self, request, slug: str):
        product = generics.get_object_or_404(Product, slug=slug)
        approved = Review.objects.filter(product=product, status=Review.Status.APPROVED).select_related("product")
        counts = dict(approved.values_list("rating").annotate(n=Count("id")))
        return Response({
            "average": product.rating_average, "count": product.rating_count,
            "breakdown": {str(star): counts.get(star, 0) for star in range(5, 0, -1)},
            "reviews": ReviewSerializer(approved[:50], many=True).data,
        })

    @extend_schema(request={"multipart/form-data": ReviewCreateSerializer}, responses={201: ReviewSerializer})
    def post(self, request, slug: str):
        """Submit a review. It appears once the team has approved it."""
        product = generics.get_object_or_404(Product, slug=slug)
        ser = ReviewCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = request.user if request.user.is_authenticated else None
        verified = bool(user) and OrderItem.objects.filter(
            product=product, order__user=user, order__status=Order.Status.DELIVERED
        ).exists()
        review = ser.save(product=product, user=user, is_verified_buyer=verified)
        return Response(ReviewSerializer(review).data, status=201)


class FeaturedReviewsView(generics.ListAPIView):
    """Reviews hand-picked for the home page carousel."""

    serializer_class = ReviewSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Review.objects.filter(status=Review.Status.APPROVED).select_related("product")
        featured = qs.filter(is_featured=True)
        return (featured if featured.exists() else qs.filter(rating__gte=4))[:12]
