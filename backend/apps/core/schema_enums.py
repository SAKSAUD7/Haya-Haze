"""Stable names for enums in the OpenAPI schema (see SPECTACULAR_SETTINGS)."""
from apps.catalog.models import ProductMedia
from apps.orders.models import Order
from apps.returns.models import ReturnRequest
from apps.shipping.models import Shipment

ORDER_STATUS = Order.Status.choices
PAYMENT_STATUS = Order.PaymentStatus.choices
RETURN_STATUS = ReturnRequest.Status.choices
RETURN_KIND = ReturnRequest.Kind.choices
SHIPMENT_STATUS = Shipment.Status.choices
MEDIA_KIND = ProductMedia.Kind.choices
