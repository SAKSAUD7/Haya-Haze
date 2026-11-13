# ruff: noqa: B023  -- image-drawing closures are called immediately, inside the same loop pass
"""Fill an empty database with a complete demo store.

    python manage.py seed_demo            # safe to re-run: updates in place
    python manage.py seed_demo --no-orders

Creates collections, 24 products with generated imagery and 3D cut-outs, coupons,
reviews, serviceable pincodes, staff roles, a superuser, CMS pages (home, about, FAQ,
legal, journal, lookbook) and a month of sample orders so the dashboard has data.
"""
import os
import random
import zlib
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import Group, Permission
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.accounts.models import User
from apps.catalog.models import Category, Collection, Product, ProductMedia, Variant
from apps.core.models import Announcement, SiteSettings
from apps.core.seed import catalog_data as cd
from apps.core.seed import content_data as content
from apps.core.seed import imagery
from apps.orders.models import Order, OrderEvent, OrderItem
from apps.promotions.models import Coupon, Subscriber
from apps.reviews.models import Review
from apps.shipping.models import ServiceablePincode

BACKDROPS = ["#FAF6F2", "#E8D5C4", "#F5EDE4", "#F2D4D0"]


def stable_seed(text: str) -> int:
    return zlib.crc32(text.encode())


class Cutouts(dict):
    """First-colour cut-out per product slug, drawn on first use only."""

    def __missing__(self, slug):
        row = next(r for r in cd.P if slugify(r[0]) == slug)
        fabric, silhouette, pattern, colours = row[3], row[7], row[9], row[10]
        accent = "#C9A84C" if pattern != "ombre" else cd.COLORS[colours[-1 if len(colours) > 1 else 0]]
        cutout = imagery.make_cutout(cd.COLORS[colours[0]], fabric, silhouette, stable_seed(f"{slug}-{colours[0]}"), pattern, accent)
        self[slug] = cutout
        return cutout


def attach(field, path: str, render) -> None:
    """Point ``field`` at ``path``. If the file is not already in storage (for example
    baked into the Docker image), draw it with ``render()`` and save it there."""
    if default_storage.exists(path):
        field.name = path
    else:
        field.save(path.rsplit("/", 1)[-1], ContentFile(render()), save=False)


class Command(BaseCommand):
    help = "Seed the demo store (catalogue, content, coupons, sample orders)."

    def add_arguments(self, parser):
        parser.add_argument("--no-orders", action="store_true", help="Skip the sample orders.")

    def handle(self, *args, **opts):
        self.cutouts = Cutouts()
        self.step("Store settings", self.settings)
        self.step("Staff roles and admin user", self.staff)
        self.step("Catalogue (generating imagery, this takes a minute)", self.catalogue)
        self.step("Coupons, pincodes, reviews", self.marketing)
        self.step("CMS pages", self.cms)
        if not opts["no_orders"]:
            self.step("Sample orders", self.orders)
        self.stdout.write(self.style.SUCCESS("\nDemo store ready."))
        shown = self.admin_password if settings.DEBUG or self.admin_password == "unchanged" else "set by DJANGO_SUPERUSER_PASSWORD"
        self.stdout.write(f"  Admin  /admin/  {self.admin_email}  (password: {shown})")
        self.stdout.write("  CMS    /cms/    same login")

    def step(self, label, fn):
        self.stdout.write(f"- {label}...")
        fn()

    # ------------------------------------------------------------------ settings
    def settings(self):
        cfg = SiteSettings.load()
        if not cfg.address:
            cfg.address = "Haya & Haze Studio\nMumbai, Maharashtra 400001\nIndia"
            cfg.contact_phone = cfg.contact_phone or "+91 98765 43210"
            cfg.whatsapp_number = cfg.whatsapp_number or "919876543210"
            cfg.save()
        if not Announcement.objects.exists():
            for i, (text, link) in enumerate([
                ("Free shipping above ₹1499 · COD available", "/shipping-policy"),
                ("New in: Haya Luxe silk hijabs for the wedding season", "/collections/haya-luxe"),
                ("Take 10% off your first order with WELCOME10", "/collections/all"),
            ]):
                Announcement.objects.create(text=text, link=link, order=i)

    # --------------------------------------------------------------------- staff
    def staff(self):
        self.admin_email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@hayaandhaze.com")
        self.admin_password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "HayaHaze@2025")
        admin = User.objects.filter(email=self.admin_email).first()
        if admin is None:
            User.objects.create_superuser(self.admin_email, self.admin_password, first_name="Store", last_name="Admin")
        else:
            self.admin_password = "unchanged"

        def perms(*specs):
            out = []
            for app, models, actions in specs:
                qs = Permission.objects.filter(content_type__app_label=app)
                if models != "*":
                    qs = qs.filter(content_type__model__in=models)
                out += [p for p in qs if p.codename.split("_")[0] in actions]
            return out

        full, edit, view = ("add", "change", "delete", "view"), ("add", "change", "view"), ("view",)
        roles = {
            "Super Admin": list(Permission.objects.all()),
            "Store Manager": perms(
                ("catalog", "*", full), ("inventory", "*", full), ("orders", "*", edit), ("payments", "*", view),
                ("shipping", "*", full), ("promotions", "*", full), ("reviews", "*", full), ("returns", "*", edit),
                ("cart", "*", view), ("accounts", ["user", "address"], edit), ("core", "*", edit),
                ("notifications", "*", view),
            ),
            "Content Editor": perms(
                ("catalog", ["product", "productmedia", "collection", "category"], edit), ("reviews", "*", edit),
                ("core", ["announcement"], full), ("wagtailcore", "*", full), ("wagtailimages", "*", full),
                ("wagtaildocs", "*", full), ("wagtailadmin", "*", full), ("content", "*", full),
            ),
            "Support": perms(
                ("orders", "*", ("change", "view")), ("returns", "*", ("change", "view")), ("shipping", "*", view),
                ("accounts", ["user", "address"], view), ("core", ["contactmessage"], ("change", "view")),
                ("reviews", "*", ("change", "view")), ("payments", "*", view), ("catalog", "*", view),
            ),
        }
        for name, permissions in roles.items():
            group, _ = Group.objects.get_or_create(name=name)
            group.permissions.set(permissions)

    # ----------------------------------------------------------------- catalogue
    @transaction.atomic
    def catalogue(self):
        categories = {}
        for i, (slug, name, guide) in enumerate(cd.CATEGORIES):
            categories[slug], _ = Category.objects.update_or_create(
                slug=slug, defaults={"name": name, "size_guide": guide, "order": i}
            )
        collections = {}
        for i, (slug, name, tagline, description, accent) in enumerate(cd.COLLECTIONS):
            collections[slug], _ = Collection.objects.update_or_create(
                slug=slug, defaults={"name": name, "tagline": tagline, "description": description,
                                     "accent_color": accent, "order": i},
            )
        Collection.objects.update_or_create(
            slug="under-999", defaults={
                "name": "Under ₹999", "tagline": "Everyday favourites, gentle on the pocket", "is_rule_based": True,
                "rule_max_price": Decimal("999"), "is_featured": False, "order": 9,
                "description": "A rule-based collection: every product priced under ₹999 appears here automatically.",
            },
        )

        rng = random.Random(7)
        for index, row in enumerate(cd.P):
            (name, coll, cat, fabric, occasion, price, compare, silhouette, shape, pattern, colours, subtitle,
             description, tags, flags) = row
            slug = slugify(name)
            accent = "#C9A84C" if pattern != "ombre" else cd.COLORS[colours[-1 if len(colours) > 1 else 0]]
            product, created = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name, "subtitle": subtitle, "description": description,
                    "fabric_care": cd.CARE[fabric], "category": categories[cat],
                    "primary_collection": collections[coll], "fabric": fabric, "occasion": occasion, "tags": tags,
                    "price": Decimal(price), "compare_at_price": Decimal(compare) if compare else None,
                    "hsn_code": "6204" if cat == "modest-wear" else "6214",
                    "gst_rate": Decimal("12") if price > 1000 else Decimal("5"),
                    "status": Product.Status.ACTIVE, "shape_preset": shape,
                    "is_featured": bool(flags.get("featured")), "is_new": bool(flags.get("new")),
                    "is_bestseller": bool(flags.get("best")), "is_top_pick": "top" in flags,
                    "top_pick_order": flags.get("top", 0), "in_wardrobe": "wardrobe" in flags,
                    "wardrobe_order": flags.get("wardrobe", 0),
                    "wardrobe_placement": "shelf" if flags.get("shelf") else "rail",
                    "sales_count": rng.randint(8, 240) + (150 if flags.get("best") else 0),
                    "seo_description": f"{subtitle}. {description}"[:168],
                },
            )
            product.collections.add(collections[coll])

            # Variants
            prefix = "".join(w[0] for w in name.split()[:3]).upper() + f"{index + 1:02d}"
            position = 0
            for colour in colours:
                code = "".join(w[0] for w in colour.split()).upper()
                options = cd.ABAYA_SIZES if cat == "modest-wear" else [("Free Size" if cat == "instant-hijabs" else "", "")]
                for size, length in options:
                    sku = "-".join(p for p in ["HH", prefix, code, size.replace(" ", "")[:4].upper()] if p)
                    stock = rng.choice([0, 3, 4, 8, 12, 15, 20, 25, 30])
                    Variant.objects.update_or_create(
                        sku=sku, defaults={
                            "product": product, "color_name": colour, "color_hex": cd.COLORS[colour], "size": size,
                            "length": length, "stock": stock, "position": position,
                            "weight_grams": 450 if cat == "modest-wear" else 120,
                        },
                    )
                    position += 1

            # Imagery (only generated once per product; reuses files already in storage)
            if created or not product.media.exists():
                product.media.all().delete()
                for n, colour in enumerate(colours):
                    seed = stable_seed(f"{slug}-{colour}")

                    def cutout(colour=colour, seed=seed):
                        if colour == colours[0]:
                            return self.cutouts[slug]
                        return imagery.make_cutout(cd.COLORS[colour], fabric, silhouette, seed, pattern, accent)

                    if n == 0:
                        attach(product.fabric_texture, f"fabric/{slug}.webp", lambda: imagery.to_bytes(self.cutouts[slug], 90))
                        product.save(update_fields=["fabric_texture"])
                    backdrop = BACKDROPS[(index + n) % len(BACKDROPS)]
                    media = ProductMedia(product=product, alt_text=f"{name} in {colour}", color_name=colour, position=n * 2)
                    attach(media.image, f"products/{slug}-{slugify(colour)}.webp",
                           lambda cutout=cutout, backdrop=backdrop: imagery.to_bytes(imagery.make_photo(cutout(), backdrop)))
                    media.save()
                    if n == 0:
                        detail = ProductMedia(product=product, alt_text=f"{name} fabric detail", position=1)
                        attach(detail.image, f"products/{slug}-detail.webp", lambda colour=colour, seed=seed: imagery.to_bytes(
                            imagery.make_closeup(cd.COLORS[colour], fabric, seed, pattern=pattern, accent=accent)))
                        detail.save()

        # Collection banners and "Complete the look" links
        banner_piece = {"haze-collection": "rosewater-chiffon-scarf", "haya-basics": "mocha-jersey-instant-hijab",
                        "haya-luxe": "champagne-silk-hijab", "covered-edit": "midnight-crepe-abaya"}
        banner_tone = {"haze-collection": ("#F2D4D0", "#E8B4A8"), "haya-basics": ("#F5EDE4", "#C8A882"),
                       "haya-luxe": ("#F5F0E8", "#C9A84C"), "covered-edit": ("#E8D5C4", "#2C4A3E")}
        for slug, collection in collections.items():
            if not collection.image:
                bg, arch = banner_tone[slug]
                attach(collection.image, f"collections/{slug}.webp", lambda bg=bg, arch=arch, slug=slug: imagery.to_bytes(
                    imagery.make_scene([(self.cutouts[banner_piece[slug]], 0.5, 0.56, 0.82)], bg, arch, (1000, 1250))))
                collection.save(update_fields=["image"])
        by_slug = {p.slug: p for p in Product.objects.all()}
        looks = {
            "midnight-crepe-abaya": ["champagne-silk-hijab", "mocha-jersey-instant-hijab", "pearl-crinkle-georgette-scarf"],
            "blush-kimono-open-abaya": ["blush-satin-silk-hijab", "rosewater-chiffon-scarf"],
            "mocha-nida-everyday-abaya": ["sandstone-georgette-wrap", "everyday-ease-instant-hijab"],
            "forest-embroidered-abaya": ["emerald-evening-silk-hijab", "gold-drizzle-silk-hijab"],
            "ivory-occasion-abaya": ["champagne-silk-hijab", "pearl-organza-silk-wrap"],
            "sandstone-flow-modest-dress": ["sandstone-georgette-wrap", "morning-mist-modal-scarf"],
            "champagne-silk-hijab": ["ivory-occasion-abaya", "midnight-crepe-abaya"],
            "rosewater-chiffon-scarf": ["blush-kimono-open-abaya", "sandstone-flow-modest-dress"],
        }
        for slug, related in looks.items():
            by_slug[slug].related_products.set([by_slug[r] for r in related])

    # ----------------------------------------------------------------- marketing
    def marketing(self):
        Coupon.objects.update_or_create(code="WELCOME10", defaults={
            "description": "10% off your first order", "kind": Coupon.Kind.PERCENT, "value": Decimal("10"),
            "max_discount": Decimal("500"), "per_customer_limit": 1, "first_order_only": True,
        })
        Coupon.objects.update_or_create(code="FREESHIP", defaults={
            "description": "Free standard shipping on orders above ₹799", "kind": Coupon.Kind.FREE_SHIPPING,
            "min_order_value": Decimal("799"),
        })
        luxe, _ = Coupon.objects.update_or_create(code="LUXE15", defaults={
            "description": "15% off Haya Luxe", "kind": Coupon.Kind.PERCENT, "value": Decimal("15"),
        })
        luxe.collections.set(Collection.objects.filter(slug="haya-luxe"))
        for pincode, city, state, std, exp in cd.PINCODES:
            ServiceablePincode.objects.update_or_create(pincode=pincode, defaults={
                "city": city, "state": state, "standard_days": std, "express_days": exp,
                "cod_available": pincode not in ("190001",),
            })
        if not Review.objects.exists():
            products = {p.name: p for p in Product.objects.all()}
            for i, (pname, name, city, rating, title, body, featured) in enumerate(cd.REVIEWS):
                review = Review.objects.create(
                    product=products[pname], name=name, location=city, rating=rating, title=title, body=body,
                    status=Review.Status.APPROVED, is_featured=featured, is_verified_buyer=i % 3 != 2,
                )
                Review.objects.filter(pk=review.pk).update(created_at=timezone.now() - timedelta(days=3 * i + 1))
            Review.objects.create(
                product=products["Pearl Crinkle Georgette Scarf"], name="Shifa D.", location="Indore", rating=4,
                title="Nice everyday scarf", body="Good quality for the price. Awaiting moderation demo review.",
            )
        for email in ["aaliyah@example.com", "sumaiya@example.com", "khadija@example.com"]:
            Subscriber.objects.get_or_create(email=email, defaults={"source": "popup"})

    # ----------------------------------------------------------------------- cms
    def _image(self, title, draw):
        """A Wagtail image drawn by ``draw()``, or the existing file of the same name."""
        from PIL import Image as PILImage
        from wagtail.images import get_image_model

        Image = get_image_model()
        existing = Image.objects.filter(title=title).first()
        if existing:
            return existing
        path = f"original_images/{slugify(title)}.webp"
        image = Image(title=title)
        if default_storage.exists(path):
            image.file.name = path
            with default_storage.open(path) as fh:
                width, height = PILImage.open(fh).size
        else:
            picture = draw()
            image.file = ContentFile(imagery.to_bytes(picture, 88), name=path.rsplit("/", 1)[-1])
            width, height = picture.width, picture.height
        # Set after assigning the file: assignment resets the dimension fields.
        image.width, image.height = width, height
        image.save()
        return image

    def cms(self):
        from wagtail.models import Page, Site

        from apps.content.models import (
            ContentPage,
            FAQPage,
            HomePage,
            JournalIndexPage,
            JournalPostPage,
            LookbookPage,
        )

        c = self.cutouts
        root = Page.get_first_root_node()
        home = HomePage.objects.first()
        if home is None:
            Page.objects.filter(depth=2).exclude(content_type__model="homepage").delete()
            root = Page.get_first_root_node()
            home = root.add_child(instance=HomePage(title="Home", slug="home"))
        Site.objects.update_or_create(
            is_default_site=True, defaults={"hostname": "localhost", "root_page": home, "site_name": "Haya & Haze"}
        )

        look1 = self._image("Look: Evening in Midnight", lambda: imagery.make_scene(
            [(c["midnight-crepe-abaya"], 0.42, 0.56, 0.86), (c["champagne-silk-hijab"], 0.72, 0.50, 0.56)],
            "#F2D4D0", "#C8A882"))
        look2 = self._image("Look: Blush for Eid", lambda: imagery.make_scene(
            [(c["blush-kimono-open-abaya"], 0.56, 0.56, 0.86), (c["blush-satin-silk-hijab"], 0.26, 0.52, 0.54)],
            "#F5EDE4", "#2C4A3E"))
        ugc_specs = [
            ("rosewater-chiffon-scarf", "#F2D4D0", "#E8B4A8"), ("mocha-jersey-instant-hijab", "#F5EDE4", "#C8A882"),
            ("champagne-silk-hijab", "#E8D5C4", "#7B4F3A"), ("forest-embroidered-abaya", "#F5F0E8", "#C9A84C"),
            ("morning-mist-modal-scarf", "#FAF6F2", "#B0AEB2"), ("sandstone-flow-modest-dress", "#F2D4D0", "#2C4A3E"),
        ]
        ugc = [
            self._image(f"Community {i + 1}", lambda slug=slug, bg=bg, arch=arch: imagery.make_scene([(c[slug], 0.5, 0.56, 0.80)], bg, arch, (800, 800)))
            for i, (slug, bg, arch) in enumerate(ugc_specs)
        ]
        cfg = SiteSettings.load()
        home.body = [
            ("hero_3d", {"enabled": True, "headline": cfg.hero_headline, "subtext": cfg.hero_subtext,
                         "primary_cta_label": "Shop the Collection", "primary_cta_link": "/collections/all",
                         "secondary_cta_label": "Explore Haya Luxe", "secondary_cta_link": "/collections/haya-luxe"}),
            ("collection_grid", {"enabled": True, "eyebrow": "Shop by collection", "title": "Four ways to feel like yourself"}),
            ("wardrobe_3d", {"enabled": True, "title": cfg.wardrobe_title, "subtitle": cfg.wardrobe_subtitle}),
            ("product_carousel", {"enabled": True, "eyebrow": "Just landed", "title": "New arrivals", "source": "new",
                                  "collection": "", "limit": 8, "cta_label": "View all new", "cta_link": "/collections/all?sort=newest"}),
            ("story", {"enabled": True, "eyebrow": "The meaning of Haya",
                       "quote": "Modesty and beauty have always belonged together.",
                       "body": "Haya is the Arabic word for modesty, dignity and inner grace. Haze is the soft, effortless beauty of fabric that moves with you. Together, they are the woman we design for.",
                       "cta_label": "Read our story", "cta_link": "/about"}),
            ("luxe_spotlight", {"enabled": True, "eyebrow": "Haya Luxe", "title": "Silk, for the moments you will remember",
                                "text": "Pure mulberry silk with a quiet glow. For Eid mornings, weddings and every occasion that deserves a little more.",
                                "product": "champagne-silk-hijab", "cta_label": "Explore Haya Luxe", "cta_link": "/collections/haya-luxe"}),
            ("product_carousel", {"enabled": True, "eyebrow": "Most loved", "title": "Bestsellers", "source": "bestsellers",
                                  "collection": "", "limit": 8, "cta_label": "Shop bestsellers", "cta_link": "/collections/all?sort=bestselling"}),
            ("lookbook", {"enabled": True, "eyebrow": "Shop the look", "title": "Styled, so you do not have to", "looks": [
                {"title": "Evening in Midnight", "caption": "Crepe abaya with a champagne silk hijab", "image": look1,
                 "hotspots": [{"x": 42, "y": 58, "product": "midnight-crepe-abaya"}, {"x": 72, "y": 42, "product": "champagne-silk-hijab"}]},
                {"title": "Blush for Eid", "caption": "Kimono abaya layered with blush satin silk", "image": look2,
                 "hotspots": [{"x": 56, "y": 60, "product": "blush-kimono-open-abaya"}, {"x": 26, "y": 44, "product": "blush-satin-silk-hijab"}]},
            ]}),
            ("reviews", {"enabled": True, "eyebrow": "Kind words", "title": "Loved by women like you"}),
            ("ugc_grid", {"enabled": True, "title": "Worn by you", "hashtag": "#HayaAndHaze",
                          "link": "https://instagram.com/hayaandhaze", "images": ugc}),
            ("trust_strip", {"enabled": True, "items": [
                {"icon": "truck", "title": "Free shipping", "text": "On orders above ₹1499"},
                {"icon": "returns", "title": "Easy returns", "text": "7 days, no awkward questions"},
                {"icon": "cash", "title": "Cash on Delivery", "text": "Available across India"},
                {"icon": "lock", "title": "Secure payment", "text": "UPI, cards and netbanking"},
            ]}),
            ("newsletter", {"enabled": True, "title": "Join the Haya & Haze family",
                            "text": "New drops, styling notes and quiet reminders. No noise."}),
        ]
        home.seo_title = cfg.seo_title
        home.search_description = cfg.seo_description
        home.save_revision().publish()

        def ensure(model, slug, parent=home, **fields):
            page = model.objects.filter(slug=slug).first()
            if page is None:
                page = parent.add_child(instance=model(slug=slug, **fields))
                page.save_revision().publish()
            return page

        ensure(ContentPage, "about", title="Our Story", intro="Draped in Grace. Defined by You.", body=content.ABOUT,
               search_description="Haya & Haze was created with one simple truth: modesty and beauty have always belonged together.")
        ensure(ContentPage, "size-guide", title="Size Guide", intro="Find your fit in a minute.", body=content.SIZE_GUIDE,
               search_description="Size and length guide for Haya & Haze abayas, modest dresses, hijabs and scarves.")
        for slug, (title, intro, body) in content.LEGAL.items():
            ensure(ContentPage, slug, title=title, intro=intro, body=body, search_description=intro)
        ensure(FAQPage, "faq", title="Frequently Asked Questions", intro="Quick answers to the things we are asked most.",
               search_description="Answers about orders, payment, Cash on Delivery, shipping, returns and fabric care.",
               groups=[("group", {"title": title, "items": [{"question": q, "answer": a} for q, a in items]})
                       for title, items in content.FAQ])
        ensure(LookbookPage, "lookbook", title="Lookbook", intro="Looks we love this season, styled head to hem.",
               search_description="Shop complete modest looks styled by Haya & Haze.",
               looks=[("look", {"title": "Evening in Midnight", "caption": "Crepe abaya with a champagne silk hijab", "image": look1,
                                "hotspots": [{"x": 42, "y": 58, "product": "midnight-crepe-abaya"}, {"x": 72, "y": 42, "product": "champagne-silk-hijab"}]}),
                      ("look", {"title": "Blush for Eid", "caption": "Kimono abaya layered with blush satin silk", "image": look2,
                                "hotspots": [{"x": 56, "y": 60, "product": "blush-kimono-open-abaya"}, {"x": 26, "y": 44, "product": "blush-satin-silk-hijab"}]})])
        journal = ensure(JournalIndexPage, "journal", title="The Journal",
                         intro="Hijab tutorials, styling notes, fabric care and stories from the Haya & Haze family.")
        covers = ["rosewater-chiffon-scarf", "champagne-silk-hijab", "midnight-crepe-abaya"]
        tones = [("#F2D4D0", "#C8A882"), ("#F5F0E8", "#C9A84C"), ("#E8D5C4", "#2C4A3E")]
        for i, (slug, title, topic, excerpt, minutes, body) in enumerate(content.JOURNAL):
            cover = self._image(f"Journal: {title}", lambda i=i: imagery.make_scene([(c[covers[i]], 0.5, 0.56, 0.80)], *tones[i], (1200, 750)))
            ensure(JournalPostPage, slug, parent=journal, title=title, topic=topic, excerpt=excerpt,
                   reading_minutes=minutes, body=body, cover=cover, search_description=excerpt)

    # -------------------------------------------------------------------- orders
    def orders(self):
        if Order.objects.exists():
            return
        rng = random.Random(21)
        customers = []
        names = ["Ayesha Khan", "Fatima Sheikh", "Zara Mirza", "Mariam Ali", "Sana Rizvi", "Noor Fatima", "Hafsa Tariq", "Iqra Baig"]
        for name in names:
            first, last = name.split()
            user, _ = User.objects.get_or_create(
                email=f"{first.lower()}@example.com", defaults={"first_name": first, "last_name": last, "phone": f"98{rng.randint(10000000, 99999999)}"}
            )
            User.objects.filter(pk=user.pk).update(date_joined=timezone.now() - timedelta(days=rng.randint(1, 28)))
            customers.append(user)
        variants = list(Variant.objects.select_related("product").filter(stock__gt=0))
        statuses = (
            [Order.Status.DELIVERED] * 5 + [Order.Status.SHIPPED] * 2 + [Order.Status.CONFIRMED] * 3
            + [Order.Status.PACKED, Order.Status.CANCELLED]
        )
        now = timezone.now()
        for n in range(46):
            user = rng.choice(customers)
            _, city, state, *_ = rng.choice(cd.PINCODES)
            pincode = next(p[0] for p in cd.PINCODES if p[1] == city)
            days_ago = int(rng.triangular(0, 29, 6))
            status = rng.choice(statuses) if days_ago > 2 else rng.choice([Order.Status.CONFIRMED, Order.Status.PACKED])
            method = rng.choice(["razorpay", "razorpay", "cod"])
            picked = rng.sample(variants, rng.choice([1, 1, 2, 2, 3]))
            subtotal = sum((v.effective_price for v in picked), Decimal("0"))
            shipping = Decimal("0") if subtotal >= 1499 else Decimal("79")
            cod_fee = Decimal("49") if method == "cod" else Decimal("0")
            tax = sum((v.effective_price - v.effective_price / (1 + (v.product.gst_rate or 5) / 100) for v in picked), Decimal("0"))
            paid = method != "cod" or status == Order.Status.DELIVERED
            order = Order.objects.create(
                idempotency_key=f"seed-demo-order-{n:04d}", user=user, email=user.email, phone=user.phone or "9876543210",
                status=status, payment_method=method, cod_verified=method == "cod" and status != Order.Status.CONFIRMED,
                payment_status=Order.PaymentStatus.PAID if paid and status != Order.Status.CANCELLED else Order.PaymentStatus.PENDING,
                ship_name=user.get_full_name(), ship_line1=f"{rng.randint(1, 180)}, {rng.choice(['Rose Villa', 'Green Park', 'Al Noor Residency', 'Lake View Apartments'])}",
                ship_city=city, ship_state=state, ship_pincode=pincode, subtotal=subtotal, shipping_total=shipping,
                cod_fee=cod_fee, tax_total=tax.quantize(Decimal("0.01")), total=subtotal + shipping + cod_fee,
            )
            when = now - timedelta(days=days_ago, hours=rng.randint(0, 20))
            Order.objects.filter(pk=order.pk).update(
                created_at=when, placed_at=when,
                delivered_at=when + timedelta(days=4) if status == Order.Status.DELIVERED else None,
            )
            for v in picked:
                media = v.product.media.filter(color_name=v.color_name).first() or v.product.media.first()
                OrderItem.objects.create(
                    order=order, variant=v, product=v.product, product_name=v.product.name, product_slug=v.product.slug,
                    variant_label=v.label, sku=v.sku, image=media.image.url if media else "",
                    hsn_code=v.product.hsn_code, gst_rate=v.product.gst_rate or 5, unit_price=v.effective_price,
                    quantity=1, line_total=v.effective_price, weight_grams=v.weight_grams,
                )
            flow = Order.FLOW
            reached = flow[1 : flow.index(status) + 1] if status in flow else [Order.Status.CONFIRMED, status]
            for step, s in enumerate(reached):
                event = OrderEvent.objects.create(order=order, status=s, note="Demo order")
                OrderEvent.objects.filter(pk=event.pk).update(created_at=when + timedelta(hours=18 * step))
