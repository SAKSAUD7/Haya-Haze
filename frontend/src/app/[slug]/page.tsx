import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsPageView } from "@/components/content/CmsPage";
import { api } from "@/lib/api/server";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 120;

/** CMS pages: /about, /faq, /lookbook, /size-guide and the policy pages. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await api.page(slug);
  if (!page) return {};
  return { title: page.seo_title, description: page.seo_description || undefined, alternates: { canonical: `/${slug}` } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await api.page(slug);
  if (!page) notFound();
  return <CmsPageView page={page} />;
}
