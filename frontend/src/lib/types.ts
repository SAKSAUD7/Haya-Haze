/**
 * API types. Everything here is derived from the generated OpenAPI schema
 * (`npm run api:types`); only CMS block payloads, which are free-form JSON, are typed by hand.
 */
import type { components } from "./api/schema";

type S = components["schemas"];

/**
 * The schema marks fields that have a server-side default as optional, but API
 * responses always include every field. `Full` reflects what actually arrives.
 */
type Full<T> = T extends (infer U)[] ? Full<U>[] : T extends object ? { [K in keyof T]-?: Full<T[K]> } : T;

export type Product = Full<S["ProductCard"]>;
export type ProductDetail = Full<S["ProductDetail"]>;
export type Variant = Full<S["Variant"]>;
export type Media = Full<S["Media"]>;
export type Collection = Full<S["Collection"]>;
export type Facets = Full<S["Facets"]>;
export type Suggest = Full<S["Suggest"]>;
export type Cart = Full<S["Cart"]>;
export type CartLine = Full<S["CartLine"]>;
export type Order = Full<S["Order"]>;
export type OrderSummary = Full<S["OrderList"]>;
export type PlaceOrderRequest = S["PlaceOrderRequest"];
export type PlaceOrderResponse = Full<S["PlaceOrderResponse"]>;
export type SiteConfig = Full<S["SiteConfig"]>;
export type Pincode = Full<S["Pincode"]>;
export type Review = Full<S["Review"]>;
export type ReviewSummary = Full<S["ReviewSummary"]>;
export type ReturnRequest = Full<S["ReturnRequest"]>;
export type Address = Full<S["Address"]>;
export type User = Full<S["User"]>;
export type WishlistItem = Full<S["WishlistItem"]>;
export type PaymentMethod = Full<S["PaymentMethod"]>;
export type Paginated<T> = { count: number; next?: string | null; previous?: string | null; results: T[] };

export type Fabric = S["FabricEnum"];
export type ShapePreset = S["ShapePresetEnum"];

/** What the checkout needs to start a payment (provider-specific public data). */
export type PaymentSession = {
  provider: "razorpay" | "stripe";
  provider_order_id: string;
  amount: string;
  currency: string;
  sandbox?: boolean;
  key_id?: string;
  redirect_url?: string;
};

// --- CMS content ------------------------------------------------------------------
export type CmsImage = { url: string; width: number; height: number; alt: string };
export type Hotspot = { x: number; y: number; product: string };
export type Look = { title: string; caption: string; image: CmsImage | null; hotspots: Hotspot[] };

type Block<T extends string, V> = { type: T; id: string; value: V & { enabled?: boolean } };

export type HomeBlock =
  | Block<"hero_3d", { headline: string; subtext: string; primary_cta_label: string; primary_cta_link: string; secondary_cta_label: string; secondary_cta_link: string }>
  | Block<"collection_grid", { eyebrow: string; title: string }>
  | Block<"wardrobe_3d", { title: string; subtitle: string }>
  | Block<"product_carousel", { eyebrow: string; title: string; source: "new" | "bestsellers" | "featured" | "collection"; collection: string; limit: number; cta_label: string; cta_link: string }>
  | Block<"story", { eyebrow: string; quote: string; body: string; cta_label: string; cta_link: string }>
  | Block<"luxe_spotlight", { eyebrow: string; title: string; text: string; product: string; cta_label: string; cta_link: string }>
  | Block<"lookbook", { eyebrow: string; title: string; looks: Look[] }>
  | Block<"reviews", { eyebrow: string; title: string }>
  | Block<"ugc_grid", { title: string; hashtag: string; link: string; images: (CmsImage | null)[] }>
  | Block<"trust_strip", { items: { icon: string; title: string; text: string }[] }>
  | Block<"newsletter", { title: string; text: string }>;

export type BodyBlock =
  | { type: "heading"; id: string; value: string }
  | { type: "paragraph"; id: string; value: string }
  | { type: "image"; id: string; value: CmsImage | null }
  | { type: "quote"; id: string; value: { text: string; attribution: string } }
  | { type: "table"; id: string; value: { caption: string; rows: string[] } };

type PageBase = { id: number; slug: string; title: string; seo_title: string; seo_description: string; updated_at: string | null };

export type HomePageData = PageBase & { type: "homepage"; blocks: HomeBlock[] };
export type ContentPageData = PageBase & { type: "contentpage"; intro: string; body: BodyBlock[] };
export type FaqPageData = PageBase & {
  type: "faqpage";
  intro: string;
  groups: { title: string; items: { question: string; answer: string }[] }[];
};
export type LookbookPageData = PageBase & { type: "lookbookpage"; intro: string; looks: Look[] };
export type JournalPostSummary = {
  slug: string; title: string; excerpt: string; topic: string; topic_label: string; author: string;
  reading_minutes: number; published_at: string | null; cover: CmsImage | null;
};
export type JournalPostData = PageBase & JournalPostSummary & { type: "journalpostpage"; body: BodyBlock[] };
export type CmsPage = HomePageData | ContentPageData | FaqPageData | LookbookPageData | JournalPostData;
