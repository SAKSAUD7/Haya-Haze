import type { Metadata } from "next";

import { Listing, type SearchParams } from "@/components/product/Listing";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const term = typeof query.q === "string" ? query.q.trim() : "";
  return (
    <div className="container-page py-10 md:py-14">
      <p className="eyebrow mb-3">Search</p>
      <h1 className="mb-8 text-4xl md:text-6xl">{term ? <>Results for “{term}”</> : "What are you looking for?"}</h1>
      {term ? (
        <Listing searchParams={query} basePath={`/search?q=${encodeURIComponent(term)}`} />
      ) : (
        <EmptyState
          title="Start with a word" text="Try a fabric, a colour or a collection: silk, blush, abaya."
          action={<Button href="/collections/all">Browse everything</Button>}
        />
      )}
    </div>
  );
}
