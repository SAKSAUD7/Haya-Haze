from decimal import Decimal

from django.template.loader import render_to_string

from apps.core.models import SiteSettings
from apps.core.utils import money


def _context(order, packing_slip=False) -> dict:
    cfg = SiteSettings.load()
    rows = []
    for item in order.items.all():
        net = item.line_total - item.discount
        tax = item.tax_amount
        taxable = net - tax if order.tax_included else net
        rows.append({"item": item, "taxable": money(taxable), "tax": tax, "total": money(taxable + tax)})
    # Intra-state supplies split GST into CGST + SGST; inter-state charge IGST.
    store_state = (cfg.address or "").lower()
    intra = bool(order.ship_state) and order.ship_state.lower() in store_state
    half = money(order.tax_total / Decimal(2))
    return {
        "order": order, "site": cfg, "rows": rows, "packing_slip": packing_slip, "intra_state": intra,
        "cgst": half, "sgst": order.tax_total - half, "igst": order.tax_total,
        "taxable_total": sum((r["taxable"] for r in rows), Decimal("0")),
    }


def render_invoice(order, packing_slip=False) -> tuple[bytes, str, str]:
    """GST invoice (or packing slip) as ``(content, content_type, extension)``.

    PDF when WeasyPrint is installed (it is in the Docker image); otherwise the same
    document as print-ready HTML.
    """
    html = render_to_string("orders/invoice.html", _context(order, packing_slip))
    try:
        from weasyprint import HTML  # type: ignore
    except (ImportError, OSError):
        return html.encode(), "text/html; charset=utf-8", "html"
    return HTML(string=html).write_pdf(), "application/pdf", "pdf"
