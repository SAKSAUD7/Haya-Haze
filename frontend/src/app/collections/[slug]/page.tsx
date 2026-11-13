import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Listing, type SearchParams } from "@/components/product/Listing";
import { Breadcrumbs, WaveDivider } from "@/components/ui/bits";
import { api } from "@/lib/api/server";
import { absoluteUrl, media } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

const ALL = {
  slug: "all", name: "Shop Everything", tagline: "Every piece, in one place",
  description: "Hijabs, scarves, instant hijabs and abayas. Filter by fabric, colour, size or occasion to find the one that feels like you.",
  image: null, seo_title: "", seo_description: "",
};

async function load(slug: string) {
  return slug === "all" ? ALL : api.collection(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await load(slug);
  if (!collection) return {};
  return {
    title: collection.seo_title || collection.name,
    description: collection.seo_description || collection.description.slice(0, 160),
    alternates: { canonical: `/collections/${slug}` },
    openGraph: { title: collection.name, description: collection.tagline, images: collection.image ? [media(collection.image)] : undefined },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const collection = await load(slug);
  if (!collection) notFound();
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: collection.name, item: absoluteUrl(`/collections/${slug}`) },
    ],
  };
  return (
    <>
      <section className="grain relative -mt-[68px] overflow-hidden bg-gradient-to-b from-blush to-ivory pt-[68px] md:-mt-20 md:pt-20">
        <div className="container-page grid items-center gap-8 py-10 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Collections", href: "/collections/all" }, { label: collection.name }]} />
            <p className="eyebrow mb-3 mt-7">{collection.tagline}</p>
            <h1 className="text-5xl md:text-7xl">{collection.name}</h1>
            <WaveDivider className="my-5 max-w-[240px]" />
            <p className="max-w-xl text-[1.05rem] text-mocha">{collection.description}</p>
          </div>
          {collection.image && (
            <div className="relative mx-auto hidden aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-t-[180px] rounded-b-[20px] shadow-lift md:block">
              <Image src={media(collection.image)} alt="" fill priority sizes="340px" className="object-cover" />
            </div>
          )}
        </div>
      </section>
      <div className="container-page pb-10 pt-6">
        <Listing searchParams={query} collection={slug === "all" ? undefined : slug} basePath={`/collections/${slug}`} />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
    </>
  );
}
