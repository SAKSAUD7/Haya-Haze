"""Content API: CMS pages as JSON for the storefront."""
from django.core.cache import cache
from django.urls import path
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ContentPage, FAQPage, HomePage, JournalIndexPage, JournalPostPage, LookbookPage


def _stream(value) -> list[dict]:
    return value.stream_block.get_api_representation(value) if value is not None else []


def _cover(page) -> dict | None:
    if not getattr(page, "cover", None):
        return None
    r = page.cover.get_rendition("fill-1200x750|format-webp")
    return {"url": r.url, "width": r.width, "height": r.height, "alt": page.cover.title}


def _post_summary(post: JournalPostPage) -> dict:
    return {
        "slug": post.slug, "title": post.title, "excerpt": post.excerpt, "topic": post.topic,
        "topic_label": post.get_topic_display(), "author": post.author, "reading_minutes": post.reading_minutes,
        "published_at": post.first_published_at, "cover": _cover(post),
    }


def serialize_page(page) -> dict:
    page = page.specific
    data = {
        "id": page.pk,
        "type": page._meta.model_name,
        "slug": page.slug,
        "title": page.title,
        "seo_title": page.seo_title or page.title,
        "seo_description": page.search_description,
        "updated_at": page.last_published_at,
    }
    if isinstance(page, HomePage):
        data["blocks"] = [b for b in _stream(page.body) if b["value"].get("enabled", True)]
    elif isinstance(page, ContentPage):
        data.update(intro=page.intro, body=_stream(page.body))
    elif isinstance(page, FAQPage):
        data.update(intro=page.intro, groups=[b["value"] for b in _stream(page.groups)])
    elif isinstance(page, LookbookPage):
        data.update(intro=page.intro, looks=[b["value"] for b in _stream(page.looks)])
    elif isinstance(page, JournalPostPage):
        data.update(_post_summary(page), body=_stream(page.body))
    elif isinstance(page, JournalIndexPage):
        data.update(intro=page.intro)
    return data


class PageSerializer(serializers.Serializer):
    """CMS content is free-form; the storefront types the block payloads itself."""

    id = serializers.IntegerField()
    type = serializers.CharField()
    slug = serializers.CharField()
    title = serializers.CharField()
    seo_title = serializers.CharField()
    seo_description = serializers.CharField()


PAGE = {200: {"type": "object", "additionalProperties": True}}


class HomeView(APIView):
    @extend_schema(responses=PAGE, operation_id="content_home")
    def get(self, request):
        page = HomePage.objects.live().first()
        if page is None:
            raise NotFound("The home page has not been published yet. Run `manage.py seed_demo`.")
        return Response(serialize_page(page))


class PageView(APIView):
    @extend_schema(responses=PAGE, operation_id="content_page")
    def get(self, request, slug: str):
        for model in (ContentPage, FAQPage, LookbookPage):
            page = model.objects.live().filter(slug=slug).first()
            if page:
                return Response(serialize_page(page))
        raise NotFound("Page not found.")


class PageListView(APIView):
    @extend_schema(responses={200: {"type": "array", "items": {"type": "object", "additionalProperties": True}}}, operation_id="content_pages")
    def get(self, request):
        """Slugs of every published page, for the sitemap."""
        out = []
        for model in (ContentPage, FAQPage, LookbookPage, JournalPostPage):
            for page in model.objects.live().only("slug", "last_published_at", "title"):
                out.append({"type": model._meta.model_name, "slug": page.slug, "title": page.title, "updated_at": page.last_published_at})
        return Response(out)


class JournalView(APIView):
    @extend_schema(responses=PAGE, operation_id="content_journal")
    def get(self, request):
        index = JournalIndexPage.objects.live().first()
        posts = JournalPostPage.objects.live().order_by("-first_published_at").select_related("cover")
        return Response({
            "title": index.title if index else "Journal",
            "intro": index.intro if index else "",
            "posts": [_post_summary(p) for p in posts],
        })


class JournalPostView(APIView):
    @extend_schema(responses=PAGE, operation_id="content_journal_post")
    def get(self, request, slug: str):
        post = JournalPostPage.objects.live().filter(slug=slug).first()
        if post is None:
            raise NotFound("Post not found.")
        return Response(serialize_page(post))


class PreviewView(APIView):
    @extend_schema(responses=PAGE, operation_id="content_preview")
    def get(self, request, key: str):
        data = cache.get(f"content-preview:{key}")
        if data is None:
            raise NotFound("This preview has expired. Open Preview again from the CMS.")
        return Response(data)


urlpatterns = [
    path("content/home/", HomeView.as_view(), name="content-home"),
    path("content/pages/", PageListView.as_view(), name="content-pages"),
    path("content/pages/<slug:slug>/", PageView.as_view(), name="content-page"),
    path("content/journal/", JournalView.as_view(), name="content-journal"),
    path("content/journal/<slug:slug>/", JournalPostView.as_view(), name="content-journal-post"),
    path("content/preview/<str:key>/", PreviewView.as_view(), name="content-preview"),
]
