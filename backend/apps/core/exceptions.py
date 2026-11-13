from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


class CommerceError(APIException):
    """A business-rule failure the shopper can act on (out of stock, bad coupon...)."""

    status_code = 400
    default_code = "commerce_error"

    def __init__(self, detail, code=None):
        super().__init__(detail=detail, code=code or self.default_code)


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        return Response({"detail": "; ".join(exc.messages)}, status=400)
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, CommerceError):
        response.data = {"detail": str(exc.detail), "code": exc.detail.code}
    return response
