import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from apps.core.models import SiteSettings

from .models import NotificationLog

log = logging.getLogger(__name__)


def send_email(template: str, to: str, subject: str, context: dict | None = None, reference: str = "") -> bool:
    """Render ``templates/emails/<template>.html`` inside the branded layout and send it."""
    cfg = SiteSettings.load()
    ctx = {"site": cfg, "frontend_url": settings.FRONTEND_URL, "subject": subject, **(context or {})}
    try:
        html = render_to_string(f"emails/{template}.html", ctx)
        text = "\n".join(line.strip() for line in strip_tags(html).splitlines() if line.strip())
        msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
        msg.attach_alternative(html, "text/html")
        msg.send()
        ok, error = True, ""
    except Exception as exc:  # never let an email failure break an order
        log.exception("Email %s to %s failed", template, to)
        ok, error = False, str(exc)[:300]
    NotificationLog.objects.create(
        template=template, recipient=to, subject=subject[:200], reference=reference, success=ok, error=error
    )
    return ok


def send_whatsapp_template(phone: str, template: str, params: dict, reference: str = "") -> bool:
    """Hook for a WhatsApp Business API provider (Interakt, Gupshup, Meta Cloud API).

    Not connected to a provider yet: it records what would be sent so the flow can be
    wired up without touching the callers.
    """
    NotificationLog.objects.create(
        channel="whatsapp", template=template, recipient=phone, reference=reference,
        success=False, error="WhatsApp provider not configured",
    )
    return False
