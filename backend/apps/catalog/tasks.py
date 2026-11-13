import io
import logging

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone

log = logging.getLogger(__name__)

TEXTURE_MAX = (768, 1024)


def cut_out(image_bytes: bytes) -> bytes:
    """Remove the background from a product photo; returns a transparent WebP.

    Uses ``rembg`` when it is installed (``pip install -r requirements/ml.txt``).
    Otherwise falls back to keying out the border colour, which works well on the
    plain Ivory Cream / Blush Sand backgrounds the brand guide prescribes.
    """
    import numpy as np
    from PIL import Image, ImageFilter

    try:
        from rembg import remove  # type: ignore

        img = Image.open(io.BytesIO(remove(image_bytes))).convert("RGBA")
    except ImportError:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        rgb = np.asarray(img, dtype=np.float32)[..., :3]
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        background = np.median(border, axis=0)
        distance = np.sqrt(((rgb - background) ** 2).sum(axis=-1))
        # Soft threshold: fully transparent near the background colour, opaque beyond.
        alpha = np.clip((distance - 14.0) / 22.0, 0.0, 1.0) * 255.0
        mask = Image.fromarray(alpha.astype("uint8")).filter(ImageFilter.MedianFilter(5))
        mask = mask.filter(ImageFilter.GaussianBlur(1.2))
        img.putalpha(mask)
    box = img.getbbox()
    if box:
        img = img.crop(box)
    img.thumbnail(TEXTURE_MAX, Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, "WEBP", quality=88, method=4)
    return out.getvalue()


@shared_task
def generate_fabric_texture(product_id: int, force: bool = False) -> bool:
    """Build the transparent cut-out the 3D sections render as cloth."""
    from .models import Product

    product = Product.objects.filter(pk=product_id).first()
    if not product or product.fabric_texture_locked:
        return False
    if product.fabric_texture and not force:
        return False
    media = product.media.exclude(image="").order_by("position", "id").first()
    if not media:
        return False
    try:
        with media.image.open("rb") as fh:
            data = cut_out(fh.read())
    except Exception:
        log.exception("Cut-out failed for product %s", product_id)
        return False
    product.fabric_texture.save(f"{product.slug}.webp", ContentFile(data), save=False)
    Product.objects.filter(pk=product.pk).update(fabric_texture=product.fabric_texture.name)
    return True


@shared_task
def publish_scheduled_products() -> int:
    """Scheduled products become visible on their own (``live()`` checks publish_at);
    this just clears the storefront cache hint by touching them once."""
    from .models import Product

    due = Product.objects.filter(status=Product.Status.ACTIVE, publish_at__lte=timezone.now())
    return due.update(publish_at=None)
