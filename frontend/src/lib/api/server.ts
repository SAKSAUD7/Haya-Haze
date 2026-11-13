import "server-only";

import type {
  CmsPage, Collection, Facets, HomePageData, JournalPostData, JournalPostSummary, Paginated, Product,
  ProductDetail, Review, ReviewSummary, SiteConfig,
} from "../types";

const BASE = `${(process.env.API_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/$/, "")}/api/v1`;

type Options = { revalidate?: number; tags?: string[] };

/** Server-side GET against Django with ISR caching. Returns null on 404. */
async function get<T>(path: string, { revalidate = 60, tags }: Options = {}): Promise<T | null> {
  // During `next build` the backend may not be up yet (e.g. both deploy together on Render).
  // Render empty pages then; ISR replaces them with real content on the next revalidation.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate, tags },
      signal: AbortSignal.timeout(building ? 15_000 : 90_000),
    });
  } catch {
    if (building) return null;
    throw new Error("The store is not reachable right now. Is the backend running?");
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    if (building) return null;
    throw new Error(`API ${response.status} for ${path}`);
  }
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const FALLBACK_SITE = {
  store_name: "Haya & Haze", tagline: "Draped in Grace. Defined by You.", contact_email: "hello@hayaandhaze.com",
  free_shipping_threshold: "1499.00", announcements: [], wardrobe_enabled: true,
} as unknown as SiteConfig;

export const api = {
  site: async () => (await get<SiteConfig>("/site/", { revalidate: 60, tags: ["site"] })) ?? FALLBACK_SITE,
  home: () => get<HomePageData>("/content/home/", { revalidate: 60, tags: ["content"] }),
  page: (slug: string) => get<CmsPage>(`/content/pages/${slug}/`, { revalidate: 120, tags: ["content"] }),
  pages: async () =>
    (await get<{ type: string; slug: string; title: string; updated_at: string | null }[]>("/content/pages/", { revalidate: 600 })) ?? [],
  preview: (key: string) => get<CmsPage>(`/content/preview/${key}/`, { revalidate: 0 }),
  journal: () =>
    get<{ title: string; intro: string; posts: JournalPostSummary[] }>("/content/journal/", { revalidate: 120, tags: ["content"] }),
  journalPost: (slug: string) => get<JournalPostData>(`/content/journal/${slug}/`, { revalidate: 120, tags: ["content"] }),
  collections: async () => (await get<Collection[]>("/collections/", { revalidate: 120, tags: ["catalog"] })) ?? [],
  collection: (slug: string) => get<Collection>(`/collections/${slug}/`, { revalidate: 120, tags: ["catalog"] }),
  products: async (params: Record<string, string | number | boolean | undefined | null> = {}, revalidate = 60) =>
    (await get<Paginated<Product>>(`/products/${query(params)}`, { revalidate, tags: ["catalog"] })) ?? { count: 0, results: [] },
  product: (slug: string) => get<ProductDetail>(`/products/${slug}/`, { revalidate: 60, tags: ["catalog"] }),
  facets: (params: Record<string, string | undefined>) => get<Facets>(`/products/facets/${query(params)}`, { revalidate: 120 }),
  reviews: (slug: string) => get<ReviewSummary>(`/products/${slug}/reviews/`, { revalidate: 60 }),
  featuredReviews: async () => (await get<Review[]>("/reviews/featured/", { revalidate: 300 })) ?? [],
};
