import type { Metadata } from "next";

import { CmsPageView } from "@/components/content/CmsPage";
import { HomeBlocks } from "@/components/home/HomeBlocks";
import { EmptyState } from "@/components/ui/bits";
import { api } from "@/lib/api/server";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Draft preview opened from the CMS "Preview" button. Links expire after 20 minutes. */
export default async function PreviewPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const page = await api.preview(key);
  if (!page) {
    return <div className="container-page"><EmptyState title="This preview has expired" text="Open Preview again from the CMS editor." /></div>;
  }
  return (
    <>
      <p className="sticky top-0 z-[60] bg-gold px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-espresso">
        Draft preview · not visible to customers
      </p>
      {page.type === "homepage" ? <HomeBlocks blocks={page.blocks} /> : <CmsPageView page={page} />}
    </>
  );
}
