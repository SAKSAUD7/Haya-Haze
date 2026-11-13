import secrets

from django.conf import settings
from django.core.cache import cache
from django.db import models
from django.shortcuts import redirect
from wagtail.admin.panels import FieldPanel
from wagtail.fields import StreamField
from wagtail.models import Page

from .blocks import BODY_BLOCKS, HOME_BLOCKS, FAQGroupBlock, LookBlock

PREVIEW_TTL = 60 * 20


class HeadlessPage(Page):
    """Pages are rendered by the Next.js storefront, not by Django templates."""

    class Meta:
        abstract = True

    def frontend_path(self) -> str:
        # url_path looks like /home/about/ → storefront path /about
        parts = [p for p in self.url_path.strip("/").split("/") if p][1:]
        return "/" + "/".join(parts)

    def get_url_parts(self, request=None):
        return (None, settings.FRONTEND_URL, self.frontend_path())

    def serve(self, request, *args, **kwargs):
        return redirect(settings.FRONTEND_URL + self.frontend_path())

    def serve_preview(self, request, mode_name):
        """Draft preview: stash the unsaved page's JSON briefly and open the storefront on it."""
        from .api import serialize_page

        key = secrets.token_urlsafe(18)
        cache.set(f"content-preview:{key}", serialize_page(self), PREVIEW_TTL)
        return redirect(f"{settings.FRONTEND_URL}/preview/{key}")


class HomePage(HeadlessPage):
    body = StreamField(HOME_BLOCKS, use_json_field=True, blank=True)

    content_panels = Page.content_panels + [FieldPanel("body")]
    max_count = 1
    subpage_types = ["content.ContentPage", "content.FAQPage", "content.JournalIndexPage", "content.LookbookPage"]

    class Meta:
        verbose_name = "Home page"


class ContentPage(HeadlessPage):
    """About, legal pages, size guide: a title, an intro and a flexible body."""

    intro = models.TextField(blank=True)
    body = StreamField(BODY_BLOCKS, use_json_field=True, blank=True)

    content_panels = Page.content_panels + [FieldPanel("intro"), FieldPanel("body")]
    parent_page_types = ["content.HomePage"]
    subpage_types: list[str] = []


class FAQPage(HeadlessPage):
    intro = models.TextField(blank=True)
    groups = StreamField([("group", FAQGroupBlock())], use_json_field=True, blank=True)

    content_panels = Page.content_panels + [FieldPanel("intro"), FieldPanel("groups")]
    parent_page_types = ["content.HomePage"]
    subpage_types: list[str] = []
    max_count = 1

    class Meta:
        verbose_name = "FAQ page"


class LookbookPage(HeadlessPage):
    intro = models.TextField(blank=True)
    looks = StreamField([("look", LookBlock())], use_json_field=True, blank=True)

    content_panels = Page.content_panels + [FieldPanel("intro"), FieldPanel("looks")]
    parent_page_types = ["content.HomePage"]
    subpage_types: list[str] = []


class JournalIndexPage(HeadlessPage):
    intro = models.TextField(blank=True)

    content_panels = Page.content_panels + [FieldPanel("intro")]
    parent_page_types = ["content.HomePage"]
    subpage_types = ["content.JournalPostPage"]
    max_count = 1

    class Meta:
        verbose_name = "Journal"


class JournalPostPage(HeadlessPage):
    class Topic(models.TextChoices):
        TUTORIAL = "tutorial", "Hijab tutorial"
        STYLE = "style", "Style notes"
        CARE = "care", "Fabric care"
        STORIES = "stories", "Haya stories"

    topic = models.CharField(max_length=12, choices=Topic.choices, default=Topic.STYLE)
    excerpt = models.TextField(max_length=300)
    cover = models.ForeignKey("wagtailimages.Image", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    author = models.CharField(max_length=80, default="The Haya & Haze Family")
    reading_minutes = models.PositiveSmallIntegerField(default=4)
    body = StreamField(BODY_BLOCKS, use_json_field=True, blank=True)

    content_panels = Page.content_panels + [
        FieldPanel("topic"), FieldPanel("excerpt"), FieldPanel("cover"), FieldPanel("author"),
        FieldPanel("reading_minutes"), FieldPanel("body"),
    ]
    parent_page_types = ["content.JournalIndexPage"]
    subpage_types: list[str] = []

    class Meta:
        verbose_name = "Journal post"
