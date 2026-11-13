import type { MetadataRoute } from "next";

import { api } from "@/lib/api/server";
import { SITE_URL } from "@/lib/utils";

export const revalidate = 3600;

/** Generated from the API: every collection, product, CMS page and journal post. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entry = (path: string, priority: number, lastModified?: string | null): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`, priority, lastModified: lastModified ? new Date(lastModified) : undefined,
  });
  const urls: MetadataRoute.Sitemap = [entry("/", 1), entry("/collections/all", 0.9), entry("/journal", 0.6), entry("/contact", 0.4), entry("/track-order", 0.3)];
  try {
    const [collections, pages] = await Promise.all([api.collections(), api.pages()]);
    for (const c of collections) urls.push(entry(`/collections/${c.slug}`, 0.8));
    for (let page = 1; page <= 20; page++) {
      const products = await api.products({ page, page_size: 60 }, 3600);
      for (const p of products.results) urls.push(entry(`/products/${p.slug}`, 0.7));
      if (!products.next) break;
    }
    for (const p of pages) urls.push(entry(p.type === "journalpostpage" ? `/journal/${p.slug}` : `/${p.slug}`, 0.5, p.updated_at));
  } catch {
    // The backend is unreachable at build time: ship the static entries rather than fail.
  }
  return urls;
}
