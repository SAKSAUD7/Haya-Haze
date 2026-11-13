import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/product/ProductCard";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { ProductView, RecentlyViewed } from "@/components/product/ProductView";
import { ReviewsSection } from "@/components/product/Reviews";
import { Breadcrumbs } from "@/components/ui/bits";
import { api } from "@/lib/api/server";
import { absoluteUrl, media } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await api.product(slug);
  if (!product) return {};
  const image = media(product.media.find((m) => m.image)?.image);
  const description = product.seo_description || product.description.slice(0, 160);
  return {
    title: product.seo_title || product.name,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: { title: product.name, description, images: [{ url: image, width: 900, height: 1200, alt: product.name }], type: "website" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, reviews] = await Promise.all([api.product(slug), api.reviews(slug)]);
  if (!product) notFound();

  const url = absoluteUrl(`/products/${product.slug}`);
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description,
      image: product.media.filter((m) => m.image).map((m) => absoluteUrl(media(m.image))),
      sku: product.variants[0]?.sku, brand: { "@type": "Brand", name: "Haya & Haze" }, category: product.category_name,
      material: product.fabric_label, color: product.swatches.map((s) => s.name).join(", "),
      ...(product.rating_count > 0 && {
        aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating_average, reviewCount: product.rating_count },
      }),
      offers: {
        "@type": "AggregateOffer", priceCurrency: "INR", url,
        lowPrice: Math.min(...product.variants.map((v) => Number(v.price))),
        highPrice: Math.max(...product.variants.map((v) => Number(v.price))),
        offerCount: product.variants.length,
        availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        ...(product.collection ? [{ "@type": "ListItem", position: 2, name: product.collection.name, item: absoluteUrl(`/collections/${product.collection.slug}`) }] : []),
        { "@type": "ListItem", position: 3, name: product.name, item: url },
      ],
    },
  ];

  return (
    <div className="container-page pb-10 pt-6">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...(product.collection ? [{ label: product.collection.name, href: `/collections/${product.collection.slug}` }] : []),
            { label: product.name },
          ]}
        />
      </div>
      <ProductView product={product} />

      {product.complete_the_look.length > 0 && (
        <section className="mt-20 rounded-[28px] bg-cream/70 p-6 md:p-10" aria-label="Complete the look">
          <p className="eyebrow mb-3">Styled together</p>
          <h2 className="mb-8 text-3xl md:text-4xl">Complete the look</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {product.complete_the_look.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <ReviewsSection slug={product.slug} name={product.name} initial={reviews} />
      <RecentlyViewed exclude={product.slug} />
      <div className="-mx-5 md:-mx-10">
        <ProductCarousel products={product.related} eyebrow="More to love" title="You may also like" />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
