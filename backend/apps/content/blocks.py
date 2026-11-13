"""StreamField blocks. Each block's API representation is plain JSON the storefront
renders with a matching React component (see frontend/src/components/home)."""
from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock
from wagtail.rich_text import expand_db_html


class ImageBlock(ImageChooserBlock):
    """An image served as a ready-to-use WebP rendition."""

    rendition = "width-1400|format-webp"

    def get_api_representation(self, value, context=None):
        if not value:
            return None
        rendition = value.get_rendition(self.rendition)
        return {"url": rendition.url, "width": rendition.width, "height": rendition.height, "alt": value.title}


class RichBlock(blocks.RichTextBlock):
    def get_api_representation(self, value, context=None):
        return expand_db_html(value.source)


def product_choices():
    from apps.catalog.models import Product

    return [(p.slug, p.name) for p in Product.objects.only("slug", "name").order_by("name")]


def collection_choices():
    from apps.catalog.models import Collection

    return [(c.slug, c.name) for c in Collection.objects.only("slug", "name")]


class SectionBlock(blocks.StructBlock):
    """Base for home page sections: every section can be switched off without deleting it."""

    enabled = blocks.BooleanBlock(required=False, default=True, help_text="Untick to hide this section.")


class Hero3DBlock(SectionBlock):
    headline = blocks.TextBlock(help_text="One line per row.", default="Comfortable enough to forget.\nBeautiful enough to remember.\nThis is Haya & Haze.")
    subtext = blocks.CharBlock(required=False, default="Hijabs and modest wear, made to move with you.")
    primary_cta_label = blocks.CharBlock(default="Shop the Collection")
    primary_cta_link = blocks.CharBlock(default="/collections/all")
    secondary_cta_label = blocks.CharBlock(default="Explore Haya Luxe")
    secondary_cta_link = blocks.CharBlock(default="/collections/haya-luxe")

    class Meta:
        icon = "pick"
        label = "3D Top Picks hero"
        help_text = "Shows the products flagged as Top Pick in the admin."


class CollectionGridBlock(SectionBlock):
    eyebrow = blocks.CharBlock(required=False, default="Shop by collection")
    title = blocks.CharBlock(default="Four ways to feel like yourself")

    class Meta:
        icon = "grip"
        label = "Collection grid"


class Wardrobe3DBlock(SectionBlock):
    title = blocks.CharBlock(default="The Haya Wardrobe")
    subtitle = blocks.CharBlock(required=False, default="Step inside. Slide the rail, lift a piece, make it yours.")

    class Meta:
        icon = "home"
        label = "3D Haya Wardrobe"
        help_text = "Shows the products flagged In Wardrobe. Wood tone and light are in Store settings."


class ProductCarouselBlock(SectionBlock):
    eyebrow = blocks.CharBlock(required=False)
    title = blocks.CharBlock()
    source = blocks.ChoiceBlock(
        choices=[("new", "New arrivals"), ("bestsellers", "Bestsellers"), ("featured", "Featured"), ("collection", "A collection")],
        default="new",
    )
    collection = blocks.ChoiceBlock(choices=collection_choices, required=False, help_text="Only for source = A collection.")
    limit = blocks.IntegerBlock(default=8, min_value=4, max_value=16)
    cta_label = blocks.CharBlock(required=False, default="View all")
    cta_link = blocks.CharBlock(required=False, default="/collections/all")

    class Meta:
        icon = "list-ul"
        label = "Product carousel"


class StoryBlock(SectionBlock):
    eyebrow = blocks.CharBlock(default="The meaning of Haya")
    quote = blocks.TextBlock()
    body = blocks.TextBlock(required=False)
    cta_label = blocks.CharBlock(required=False, default="Read our story")
    cta_link = blocks.CharBlock(required=False, default="/about")

    class Meta:
        icon = "openquote"
        label = "Brand story"


class LuxeSpotlightBlock(SectionBlock):
    eyebrow = blocks.CharBlock(default="Haya Luxe")
    title = blocks.CharBlock()
    text = blocks.TextBlock(required=False)
    product = blocks.ChoiceBlock(choices=product_choices, required=False, help_text="Hero product. Empty = first Haya Luxe piece.")
    cta_label = blocks.CharBlock(default="Explore Haya Luxe")
    cta_link = blocks.CharBlock(default="/collections/haya-luxe")

    class Meta:
        icon = "success"
        label = "Haya Luxe spotlight"


class HotspotBlock(blocks.StructBlock):
    x = blocks.IntegerBlock(min_value=0, max_value=100, help_text="Horizontal position, % from the left.")
    y = blocks.IntegerBlock(min_value=0, max_value=100, help_text="Vertical position, % from the top.")
    product = blocks.ChoiceBlock(choices=product_choices)


class LookBlock(blocks.StructBlock):
    title = blocks.CharBlock(required=False)
    caption = blocks.CharBlock(required=False)
    image = ImageBlock()
    hotspots = blocks.ListBlock(HotspotBlock(), max_num=5)

    class Meta:
        icon = "image"
        label = "Look"


class LookbookBlock(SectionBlock):
    eyebrow = blocks.CharBlock(required=False, default="Shop the look")
    title = blocks.CharBlock(default="Styled, so you do not have to")
    looks = blocks.ListBlock(LookBlock(), max_num=3)

    class Meta:
        icon = "image"
        label = "Shop the Look"


class ReviewsBlock(SectionBlock):
    eyebrow = blocks.CharBlock(required=False, default="Kind words")
    title = blocks.CharBlock(default="Loved by women like you")

    class Meta:
        icon = "comment"
        label = "Reviews carousel"
        help_text = "Shows reviews marked Featured in the admin."


class UGCGridBlock(SectionBlock):
    title = blocks.CharBlock(default="Worn by you")
    hashtag = blocks.CharBlock(default="#HayaAndHaze")
    link = blocks.URLBlock(default="https://instagram.com/hayaandhaze")
    images = blocks.ListBlock(ImageBlock(rendition="fill-600x600|format-webp"), max_num=8)

    class Meta:
        icon = "group"
        label = "Instagram / UGC grid"


class TrustItemBlock(blocks.StructBlock):
    icon = blocks.ChoiceBlock(choices=[("truck", "Shipping"), ("returns", "Returns"), ("cash", "COD"), ("lock", "Secure payment"), ("gift", "Gift")])
    title = blocks.CharBlock()
    text = blocks.CharBlock(required=False)


class TrustStripBlock(SectionBlock):
    items = blocks.ListBlock(TrustItemBlock(), max_num=4)

    class Meta:
        icon = "tick-inverse"
        label = "Trust strip"


class NewsletterBlock(SectionBlock):
    title = blocks.CharBlock(default="Join the Haya & Haze family")
    text = blocks.CharBlock(required=False, default="New drops, styling notes and quiet reminders. No noise.")

    class Meta:
        icon = "mail"
        label = "Newsletter"


HOME_BLOCKS = [
    ("hero_3d", Hero3DBlock()),
    ("collection_grid", CollectionGridBlock()),
    ("wardrobe_3d", Wardrobe3DBlock()),
    ("product_carousel", ProductCarouselBlock()),
    ("story", StoryBlock()),
    ("luxe_spotlight", LuxeSpotlightBlock()),
    ("lookbook", LookbookBlock()),
    ("reviews", ReviewsBlock()),
    ("ugc_grid", UGCGridBlock()),
    ("trust_strip", TrustStripBlock()),
    ("newsletter", NewsletterBlock()),
]


class FAQItemBlock(blocks.StructBlock):
    question = blocks.CharBlock()
    answer = RichBlock(features=["bold", "italic", "link", "ul"])


class FAQGroupBlock(blocks.StructBlock):
    title = blocks.CharBlock()
    items = blocks.ListBlock(FAQItemBlock())

    class Meta:
        icon = "help"
        label = "Question group"


class QuoteBlock(blocks.StructBlock):
    text = blocks.TextBlock()
    attribution = blocks.CharBlock(required=False)

    class Meta:
        icon = "openquote"


BODY_BLOCKS = [
    ("heading", blocks.CharBlock(form_classname="title", icon="title")),
    ("paragraph", RichBlock(features=["bold", "italic", "link", "ol", "ul", "h3", "hr"])),
    ("image", ImageBlock()),
    ("quote", QuoteBlock()),
    ("table", blocks.StructBlock(
        [("caption", blocks.CharBlock(required=False)),
         ("rows", blocks.ListBlock(blocks.CharBlock(help_text="Cells separated by | — the first row is the header.")))],
        icon="table", label="Simple table",
    )),
]
