import { ProductCarousel } from "@/components/product/ProductCarousel";
import { api } from "@/lib/api/server";
import type { HomeBlock, Product } from "@/lib/types";

import { HeroSection } from "./HeroSection";
import {
  CollectionGrid, LookbookBlock, LuxeSpotlight, NewsletterBlock, ReviewsCarousel, StoryBlock, TrustStrip, UGCGrid,
} from "./Sections";
import { WardrobeSection } from "./WardrobeSection";

const CAROUSEL_QUERY = {
  new: { sort: "newest" },
  bestsellers: { sort: "bestselling" },
  featured: { is_featured: true },
} as const;

/** Renders the home page from its CMS blocks, fetching whatever each block needs. */
export async function HomeBlocks({ blocks }: { blocks: HomeBlock[] }) {
  const types = new Set(blocks.map((b) => b.type));
  const hotspotSlugs = blocks.flatMap((b) => (b.type === "lookbook" ? b.value.looks.flatMap((l) => l.hotspots.map((h) => h.product)) : []));
  const luxeSlug = blocks.find((b) => b.type === "luxe_spotlight")?.value.product;

  const [collections, topPicks, wardrobe, reviews, catalogue] = await Promise.all([
    api.collections(),
    types.has("hero_3d") ? api.products({ top_pick: true, page_size: 12 }) : null,
    types.has("wardrobe_3d") ? api.products({ in_wardrobe: true, page_size: 40 }) : null,
    types.has("reviews") ? api.featuredReviews() : [],
    // One catalogue read covers lookbook hotspots and the Luxe spotlight.
    hotspotSlugs.length || types.has("luxe_spotlight") ? api.products({ page_size: 60 }) : null,
  ]);
  const bySlug = new Map((catalogue?.results ?? []).map((p) => [p.slug, p]));
  const carousels = new Map<string, Product[]>();
  await Promise.all(
    blocks.map(async (block) => {
      if (block.type !== "product_carousel") return;
      const { source, collection, limit } = block.value;
      const params = source === "collection" ? { collection, sort: "featured" } : CAROUSEL_QUERY[source];
      carousels.set(block.id, (await api.products({ ...params, page_size: limit || 8 })).results);
    }),
  );

  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case "hero_3d":
            return <HeroSection key={block.id} value={block.value} products={topPicks?.results ?? []} />;
          case "collection_grid":
            return <CollectionGrid key={block.id} value={block.value} collections={collections} />;
          case "wardrobe_3d":
            return (
              <WardrobeSection
                key={block.id} title={block.value.title} subtitle={block.value.subtitle}
                products={wardrobe?.results ?? []} collections={collections}
              />
            );
          case "product_carousel":
            return (
              <ProductCarousel
                key={block.id} products={carousels.get(block.id) ?? []} eyebrow={block.value.eyebrow} title={block.value.title}
                cta={block.value.cta_label ? { label: block.value.cta_label, href: block.value.cta_link } : undefined}
              />
            );
          case "story":
            return <StoryBlock key={block.id} value={block.value} />;
          case "luxe_spotlight": {
            const product = (luxeSlug && bySlug.get(luxeSlug)) || [...bySlug.values()].find((p) => p.collection?.slug === "haya-luxe");
            return <LuxeSpotlight key={block.id} value={block.value} product={product} />;
          }
          case "lookbook":
            return <LookbookBlock key={block.id} value={block.value} products={hotspotSlugs.map((s) => bySlug.get(s)).filter((p): p is Product => Boolean(p))} />;
          case "reviews":
            return <ReviewsCarousel key={block.id} value={block.value} reviews={reviews} />;
          case "ugc_grid":
            return <UGCGrid key={block.id} value={block.value} />;
          case "trust_strip":
            return <TrustStrip key={block.id} value={block.value} />;
          case "newsletter":
            return <NewsletterBlock key={block.id} value={block.value} />;
          default:
            return null;
        }
      })}
    </>
  );
}
