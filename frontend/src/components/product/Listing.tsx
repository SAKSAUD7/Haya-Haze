import { Suspense } from "react";

import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/server";

import { Filters, Pagination } from "./Filters";
import { ProductGrid } from "./ProductCard";

const PAGE_SIZE = 24;
const FILTER_KEYS = ["sort", "color", "size", "fabric", "occasion", "category", "min_price", "max_price", "in_stock", "on_sale", "q"];

export type SearchParams = Record<string, string | string[] | undefined>;

/** Filterable product grid shared by collection pages and search. */
export async function Listing({
  searchParams, collection, basePath,
}: { searchParams: SearchParams; collection?: string; basePath: string }) {
  const query: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = searchParams[key];
    if (typeof value === "string" && value) query[key] = value;
  }
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [products, facets] = await Promise.all([
    api.products({ ...query, collection, page, page_size: PAGE_SIZE }, 30),
    api.facets({ collection, q: query.q }),
  ]);
  const pages = Math.ceil(products.count / PAGE_SIZE);

  // Filters renders three grid children: the toolbar (full width), the desktop sidebar
  // (left column) and the mobile drawer. Results sit in the right column.
  return (
    <div className="lg:grid lg:grid-cols-[230px_1fr] lg:gap-x-12">
      <Suspense fallback={<div className="skeleton h-12 lg:col-span-2" />}>
        <Filters facets={facets} total={products.count} showCategories={!collection} />
      </Suspense>
      <div className="mt-8 lg:col-start-2 lg:row-start-2">
        {products.results.length === 0 ? (
          <EmptyState
            title="Nothing matches just yet"
            text="Try removing a filter or two. New pieces arrive often."
            action={<Button href={basePath} variant="outline">Clear filters</Button>}
          />
        ) : (
          <>
            <ProductGrid products={products.results} priorityCount={4} />
            <Suspense><Pagination page={page} pages={pages} /></Suspense>
          </>
        )}
      </div>
    </div>
  );
}
