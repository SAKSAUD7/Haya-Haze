"""Procedural placeholder photography for the demo store.

Draws believable fabric (folds, sheen, weave) in a garment silhouette, as:
  * a transparent cut-out  -> Product.fabric_texture (what the 3D sections animate)
  * a styled product photo -> the cut-out on an Ivory Cream / Blush Sand backdrop

Replace with real photography before launch; nothing else depends on this module.
"""
import io

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 768, 1024

FABRIC_LOOK = {
    # fold depth, sheen strength, grain, opacity
    "silk": (0.20, 0.34, 0.006, 1.0),
    "chiffon": (0.13, 0.08, 0.012, 0.93),
    "georgette": (0.12, 0.05, 0.022, 0.95),
    "modal": (0.12, 0.12, 0.010, 1.0),
    "viscose": (0.12, 0.10, 0.012, 1.0),
    "jersey": (0.10, 0.03, 0.016, 1.0),
    "crepe": (0.11, 0.04, 0.026, 1.0),
    "nida": (0.12, 0.07, 0.014, 1.0),
}


def hex_rgb(value: str) -> np.ndarray:
    value = value.lstrip("#")
    return np.array([int(value[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def _smooth(mask: Image.Image, radius: float) -> Image.Image:
    """Round a hard-edged mask's corners and anti-alias its edge."""
    blurred = np.asarray(mask.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0
    edge = np.clip((blurred - 0.42) / 0.16, 0, 1)
    return Image.fromarray((edge * 255).astype("uint8"))


def _poly_mask(points, holes=(), radius=7.0) -> Image.Image:
    mask = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(x * W, y * H) for x, y in points], fill=255)
    for cx, cy, rx, ry in holes:
        draw.ellipse([(cx - rx) * W, (cy - ry) * H, (cx + rx) * W, (cy + ry) * H], fill=0)
    return _smooth(mask, radius)


def mask_scarf(rng) -> Image.Image:
    """A scarf laid flat: a tall rectangle with softly wandering edges."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    x, y = xx / W, yy / H
    p1, p2, p3, p4 = rng.uniform(0, 6.28, 4)
    left = 0.07 + 0.010 * np.sin(y * 9 + p1) + 0.004 * np.sin(y * 31 + p2)
    right = 0.93 + 0.010 * np.sin(y * 8 + p3) + 0.004 * np.sin(y * 27 + p1)
    top = 0.035 + 0.006 * np.sin(x * 11 + p4)
    bottom = 0.965 + 0.008 * np.sin(x * 9 + p2) + 0.004 * np.sin(x * 37 + p3)
    inside = (x > left) & (x < right) & (y > top) & (y < bottom)
    return _smooth(Image.fromarray((inside * 255).astype("uint8")), 3.0)


def mask_abaya(open_front=False) -> Image.Image:
    points = [
        (0.435, 0.030), (0.500, 0.058), (0.565, 0.030),          # neckline
        (0.660, 0.062), (0.800, 0.250), (0.965, 0.520),          # right shoulder, sleeve top
        (0.985, 0.585), (0.880, 0.640),                          # right cuff
        (0.690, 0.345), (0.730, 0.640), (0.815, 0.985),          # underarm, side seam, hem
        (0.185, 0.985), (0.270, 0.640), (0.310, 0.345),          # hem, left side seam
        (0.120, 0.640), (0.015, 0.585), (0.035, 0.520),          # left cuff
        (0.200, 0.250), (0.340, 0.062),
    ]
    return _poly_mask(points, radius=8.0)


def mask_dress() -> Image.Image:
    points = [
        (0.440, 0.030), (0.500, 0.070), (0.560, 0.030), (0.650, 0.060), (0.760, 0.200), (0.850, 0.430),
        (0.760, 0.470), (0.670, 0.300), (0.655, 0.420), (0.700, 0.520), (0.860, 0.985),
        (0.140, 0.985), (0.300, 0.520), (0.345, 0.420), (0.330, 0.300), (0.240, 0.470), (0.150, 0.430),
        (0.240, 0.200), (0.350, 0.060),
    ]
    return _poly_mask(points, radius=8.0)


def mask_hijab() -> Image.Image:
    """An instant hijab as worn: rounded crown, open face, drape falling to a soft point."""
    t = np.linspace(np.pi, 2 * np.pi, 26)
    crown = [(0.5 + 0.235 * np.cos(a), 0.265 + 0.235 * np.sin(a)) for a in t]
    drape = [(0.760, 0.330), (0.900, 0.640), (0.930, 0.800), (0.720, 0.900), (0.500, 0.975),
             (0.280, 0.900), (0.070, 0.800), (0.100, 0.640), (0.240, 0.330)]
    return _poly_mask(crown + drape, holes=[(0.5, 0.275, 0.118, 0.148)], radius=9.0)


def _fabric(color: str, fabric: str, rng, *, fan=False, pattern="plain", accent="#C9A84C") -> np.ndarray:
    """An RGB float image (0-255) of draped fabric in ``color``."""
    depth, sheen, grain, _ = FABRIC_LOOK.get(fabric, FABRIC_LOOK["modal"])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    x, y = xx / W, yy / H
    # Folds run top to bottom and wander; on garments they fan out toward the hem.
    u = (x - 0.5) / (0.42 + 0.58 * y) + 0.5 if fan else x
    folds = np.zeros_like(x)
    for freq, amp in ((2.3, 0.50), (4.1, 0.30), (7.3, 0.16), (12.7, 0.07)):
        phase = rng.uniform(0, 6.28)
        drift = 0.06 * np.sin(y * rng.uniform(2.0, 4.5) + rng.uniform(0, 6.28))
        folds += amp * np.sin(6.2832 * freq * (u + drift) + phase)
    folds *= 0.35 + 0.65 * y  # tighter at the top where the cloth is gathered or pinned
    base = hex_rgb(color)

    tint = np.ones((H, W, 3), dtype=np.float32) * base
    if pattern == "ombre":
        other = hex_rgb(accent)
        mix = np.clip((y - 0.25) / 0.7, 0, 1)[..., None]
        tint = tint * (1 - mix) + other * mix
    elif pattern == "border":
        band = ((x < 0.135) | (x > 0.865) | (y < 0.085) | (y > 0.915)).astype(np.float32)
        line = ((np.abs(x - 0.16) < 0.004) | (np.abs(x - 0.84) < 0.004)).astype(np.float32)
        mix = np.clip(band + line, 0, 1)[..., None]
        tint = tint * (1 - mix) + hex_rgb(accent) * mix
    elif pattern == "pinstripe":
        stripe = (np.sin(u * 150) > 0.93).astype(np.float32)[..., None]
        tint = tint * (1 - 0.35 * stripe) + hex_rgb(accent) * 0.35 * stripe
    elif pattern == "trim":
        # embroidered band at the cuffs and hem of a garment
        hem = ((y > 0.93) & (y < 0.965)).astype(np.float32)
        dots = (np.sin(x * 190) * np.sin(y * 190) > 0.55).astype(np.float32)
        mix = np.clip(hem * (0.55 + 0.45 * dots), 0, 1)[..., None]
        tint = tint * (1 - mix) + hex_rgb(accent) * mix

    shade = 1.0 + depth * folds
    rgb = tint * shade[..., None]
    # Sheen: light catches the crest of each fold, tinted warm.
    crest = np.clip(folds, 0, 1) ** 3
    rgb += (np.array([255, 240, 214], dtype=np.float32) - rgb) * (sheen * crest)[..., None]
    # Weave / grain
    noise = rng.normal(0, 1, (H, W)).astype(np.float32)
    if fabric == "jersey":
        noise = noise * 0.5 + np.sin(yy * 2.1) * 0.9
    if fabric in ("crepe", "georgette"):
        noise = np.asarray(Image.fromarray((noise * 40 + 128).clip(0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32)
        noise = (noise - 128) / 18
    rgb *= (1.0 + grain * noise)[..., None]
    return rgb


def make_cutout(color, fabric, silhouette, seed, pattern="plain", accent="#C9A84C") -> Image.Image:
    rng = np.random.default_rng(seed)
    garment = silhouette in ("abaya", "dress", "hijab")
    mask = {"abaya": mask_abaya, "dress": mask_dress, "hijab": mask_hijab}.get(silhouette, lambda: mask_scarf(rng))()
    rgb = _fabric(color, fabric, rng, fan=garment, pattern=pattern, accent=accent)
    m = np.asarray(mask, dtype=np.float32) / 255.0

    # Volume: darken toward the silhouette edge, like light falling off a rounded form.
    inner = np.asarray(mask.filter(ImageFilter.GaussianBlur(26)), dtype=np.float32) / 255.0
    rgb *= (0.80 + 0.20 * np.clip(inner * 1.25, 0, 1))[..., None]

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    x, y = xx / W, yy / H
    if silhouette in ("abaya", "dress"):
        seam = np.exp(-((x - 0.5) / 0.0035) ** 2) * (y > 0.06)
        rgb *= (1 - 0.16 * seam)[..., None]
    if silhouette == "hijab":
        ring = np.sqrt(((x - 0.5) / 0.118) ** 2 + ((y - 0.275) / 0.148) ** 2)
        band = np.exp(-((ring - 1.13) / 0.07) ** 2)
        rgb *= (1 - 0.14 * band)[..., None]
    if silhouette == "scarf":
        hem = np.minimum.reduce([x - 0.07, 0.93 - x, y - 0.035, 0.965 - y])
        rgb *= (1 - 0.10 * np.exp(-((hem - 0.018) / 0.004) ** 2))[..., None]

    opacity = FABRIC_LOOK.get(fabric, FABRIC_LOOK["modal"])[3]
    rgba = np.dstack([rgb.clip(0, 255), m * 255 * opacity]).astype("uint8")
    return Image.fromarray(rgba, "RGBA")


def backdrop(color="#FAF6F2", size=(900, 1200)) -> Image.Image:
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx / w) - 0.5) ** 2 + ((yy / h) - 0.45) ** 2)
    light = 1.03 - 0.16 * d**1.6
    rgb = hex_rgb(color)[None, None, :] * light[..., None]
    return Image.fromarray(rgb.clip(0, 255).astype("uint8"), "RGB")


def make_photo(cutout: Image.Image, background="#FAF6F2", size=(900, 1200), scale=0.86) -> Image.Image:
    """The cut-out on a studio backdrop with a soft contact shadow."""
    canvas = backdrop(background, size)
    w, h = size
    target_h = int(h * scale)
    target_w = int(cutout.width * target_h / cutout.height)
    if target_w > w * 0.92:
        target_w = int(w * 0.92)
        target_h = int(cutout.height * target_w / cutout.width)
    piece = cutout.resize((target_w, target_h), Image.LANCZOS)
    ox, oy = (w - target_w) // 2, (h - target_h) // 2
    shadow = Image.new("L", size, 0)
    shadow.paste(piece.getchannel("A"), (ox + 10, oy + 22))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26)).point(lambda v: int(v * 0.30))
    canvas.paste(Image.new("RGB", size, (74, 44, 42)), (0, 0), shadow)
    canvas.paste(piece, (ox, oy), piece)
    return canvas


def make_closeup(color, fabric, seed, size=(900, 1200), pattern="plain", accent="#C9A84C") -> Image.Image:
    """A tight fabric detail shot (second gallery image / hover image)."""
    rng = np.random.default_rng(seed + 7)
    rgb = _fabric(color, fabric, rng, pattern="plain" if pattern in ("border", "trim") else pattern, accent=accent)
    img = Image.fromarray(rgb.clip(0, 255).astype("uint8"), "RGB")
    crop = img.crop((W // 5, H // 4, W // 5 + W // 2, H // 4 + int(W / 2 * size[1] / size[0])))
    return crop.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.6))


def make_scene(pieces, background="#F2D4D0", arch="#C8A882", size=(1400, 1050)) -> Image.Image:
    """An editorial composition: an arch on a wall with cut-outs arranged before it.

    ``pieces`` is a list of ``(cutout, centre_x, centre_y, height_fraction)``.
    """
    w, h = size
    canvas = backdrop(background, size)
    arch_layer = Image.new("L", size, 0)
    draw = ImageDraw.Draw(arch_layer)
    aw, top = int(w * 0.42), int(h * 0.10)
    left = (w - aw) // 2
    draw.pieslice([left, top, left + aw, top + aw], 180, 360, fill=255)
    draw.rectangle([left, top + aw // 2, left + aw, h], fill=255)
    arch_layer = arch_layer.filter(ImageFilter.GaussianBlur(1.5))
    canvas.paste(Image.new("RGB", size, tuple(int(c) for c in hex_rgb(arch))), (0, 0), arch_layer)
    for cutout, cx, cy, frac in pieces:
        th = int(h * frac)
        tw = int(cutout.width * th / cutout.height)
        piece = cutout.resize((tw, th), Image.LANCZOS)
        ox, oy = int(cx * w - tw / 2), int(cy * h - th / 2)
        shadow = Image.new("L", size, 0)
        shadow.paste(piece.getchannel("A"), (ox + 12, oy + 20))
        shadow = shadow.filter(ImageFilter.GaussianBlur(22)).point(lambda v: int(v * 0.32))
        canvas.paste(Image.new("RGB", size, (61, 43, 31)), (0, 0), shadow)
        canvas.paste(piece, (ox, oy), piece)
    return canvas


def to_bytes(img: Image.Image, quality=86) -> bytes:
    out = io.BytesIO()
    img.save(out, "WEBP", quality=quality, method=4)
    return out.getvalue()
