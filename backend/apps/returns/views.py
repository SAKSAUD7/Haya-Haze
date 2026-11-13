import json

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import parsers, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import CommerceError
from apps.core.utils import media_url
from apps.notifications import tasks
from apps.orders.models import Order

from .models import ReturnItem, ReturnPhoto, ReturnRequest


class ReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="order_item.product_name", read_only=True)
    variant_label = serializers.CharField(source="order_item.variant_label", read_only=True)
    image = serializers.CharField(source="order_item.image", read_only=True)

    class Meta:
        model = ReturnItem
        fields = ["order_item", "quantity", "product_name", "variant_label", "image"]


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.number", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    items = ReturnItemSerializer(many=True, read_only=True)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = ReturnRequest
        fields = [
            "id", "order_number", "kind", "kind_label", "reason", "reason_label", "details", "status",
            "status_label", "refund_amount", "admin_note", "items", "photos", "created_at",
        ]

    def get_photos(self, obj) -> list[str]:
        return [media_url(p.image) for p in obj.photos.all()]


class ReturnCreateSerializer(serializers.Serializer):
    order_number = serializers.CharField()
    kind = serializers.ChoiceField(choices=ReturnRequest.Kind.choices)
    reason = serializers.ChoiceField(choices=ReturnRequest.Reason.choices)
    details = serializers.CharField(allow_blank=True, required=False, default="", max_length=1000)
    items = serializers.CharField(help_text='JSON list: [{"order_item": 12, "quantity": 1}]')
    photos = serializers.ListField(child=serializers.ImageField(), required=False, max_length=4)


class ReturnsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    @extend_schema(responses=ReturnRequestSerializer(many=True))
    def get(self, request):
        qs = (
            ReturnRequest.objects.filter(user=request.user).select_related("order")
            .prefetch_related("items__order_item", "photos")
        )
        return Response(ReturnRequestSerializer(qs, many=True).data)

    @extend_schema(request={"multipart/form-data": ReturnCreateSerializer}, responses={201: ReturnRequestSerializer})
    @transaction.atomic
    def post(self, request):
        """Ask to return or exchange delivered items (within 7 days of delivery)."""
        ser = ReturnCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        order = Order.objects.filter(number=data["order_number"].upper(), user=request.user).first()
        if order is None:
            raise CommerceError("We could not find that order.", code="not_found")
        if not order.is_returnable:
            raise CommerceError("Returns are open for 7 days after delivery.", code="not_returnable")
        if order.return_requests.filter(status__in=ReturnRequest.OPEN).exists():
            raise CommerceError("There is already an open request for this order.", code="duplicate")
        try:
            lines = json.loads(data["items"]) if isinstance(data["items"], str) else data["items"]
            wanted = {int(line["order_item"]): int(line.get("quantity", 1)) for line in lines}
        except (ValueError, KeyError, TypeError):
            raise CommerceError("Please choose the items you would like to return.")
        order_items = {i.id: i for i in order.items.filter(id__in=wanted)}
        if not order_items:
            raise CommerceError("Please choose the items you would like to return.")
        req = ReturnRequest.objects.create(
            order=order, user=request.user, kind=data["kind"], reason=data["reason"], details=data["details"]
        )
        refund = 0
        for item_id, item in order_items.items():
            qty = max(1, min(wanted[item_id], item.quantity))
            ReturnItem.objects.create(request=req, order_item=item, quantity=qty)
            refund += (item.line_total - item.discount) / item.quantity * qty
        if req.kind == ReturnRequest.Kind.RETURN:
            req.refund_amount = round(refund, 2)
            req.save(update_fields=["refund_amount"])
        for photo in request.FILES.getlist("photos")[:4]:
            ReturnPhoto.objects.create(request=req, image=photo)
        transaction.on_commit(lambda: tasks.send_return_update_email.delay(req.pk))
        return Response(ReturnRequestSerializer(req).data, status=201)
