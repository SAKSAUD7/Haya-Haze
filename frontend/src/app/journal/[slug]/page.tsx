import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsPageView } from "@/components/content/CmsPage";
import { api } from "@/lib/api/server";
import { absoluteUrl } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 120;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await api.journalPost(slug);
  if (!post) return {};
  return {
    title: post.seo_title, description: post.seo_description || post.excerpt, alternates: { canonical: `/journal/${slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt, images: post.cover ? [post.cover.url] : undefined },
  };
}

export default async function JournalPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await api.journalPost(slug);
  if (!post) notFound();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt,
    datePublished: post.published_at, dateModified: post.updated_at ?? post.published_at,
    author: { "@type": "Organization", name: post.author }, publisher: { "@type": "Organization", name: "Haya & Haze" },
    image: post.cover ? [absoluteUrl(post.cover.url)] : undefined, mainEntityOfPage: absoluteUrl(`/journal/${slug}`),
  };
  return (
    <>
      <CmsPageView page={post} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
