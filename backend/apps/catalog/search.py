from django.conf import settings
from django.db.models import Q


def search_products(qs, term: str):
    """Rank ``qs`` by relevance to ``term``.

    Postgres: full-text search plus trigram similarity so typos ("chifon") still match.
    Anything else (SQLite in local mode): case-insensitive substring match.
    """
    term = (term or "").strip()[:80]
    if not term:
        return qs
    if settings.IS_POSTGRES:
        from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector, TrigramSimilarity

        vector = (
            SearchVector("name", weight="A")
            + SearchVector("subtitle", "tags", weight="B")
            + SearchVector("description", weight="C")
        )
        query = SearchQuery(term, search_type="websearch")
        return (
            qs.annotate(rank=SearchRank(vector, query), similarity=TrigramSimilarity("name", term))
            .filter(Q(rank__gt=0.01) | Q(similarity__gt=0.15) | Q(variants__color_name__icontains=term))
            .order_by("-rank", "-similarity")
            .distinct()
        )
    q = Q()
    for word in term.split():
        q &= (
            Q(name__icontains=word) | Q(subtitle__icontains=word) | Q(tags__icontains=word)
            | Q(fabric__icontains=word) | Q(variants__color_name__icontains=word)
            | Q(primary_collection__name__icontains=word) | Q(category__name__icontains=word)
        )
    return qs.filter(q).distinct()
