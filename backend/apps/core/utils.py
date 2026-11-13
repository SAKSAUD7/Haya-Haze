from decimal import ROUND_HALF_UP, Decimal

TWO = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(value).quantize(TWO, rounding=ROUND_HALF_UP)


def media_url(file_field) -> str | None:
    """URL for a stored file. Local media stays relative: the storefront proxies /media."""
    if not file_field:
        return None
    try:
        return file_field.url
    except ValueError:
        return None
