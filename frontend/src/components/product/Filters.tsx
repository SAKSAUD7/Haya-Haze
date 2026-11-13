"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { Facets } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

const SORTS = [
  ["featured", "Featured"], ["newest", "Newest"], ["bestselling", "Bestselling"], ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"], ["rating", "Top rated"],
] as const;

const PRICE_BANDS = [
  { label: "Under ₹999", min: "", max: "999" },
  { label: "₹1,000 – ₹2,499", min: "1000", max: "2499" },
  { label: "₹2,500 and above", min: "2500", max: "" },
];

/** Filters and sorting. All state lives in the URL, so results are shareable and back/forward work. */
export function Filters({ facets, total, showCategories = true }: { facets: Facets | null; total: number; showCategories?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const list = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const push = (next: URLSearchParams) => {
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  const toggle = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    const values = list(key);
    const updated = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    if (updated.length) next.set(key, updated.join(","));
    else next.delete(key);
    push(next);
  };
  const set = (entries: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(entries)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    push(next);
  };
  const clear = () => {
    const next = new URLSearchParams();
    for (const keep of ["q", "sort"]) if (params.get(keep)) next.set(keep, params.get(keep)!);
    push(next);
  };

  const activeCount =
    ["color", "size", "fabric", "occasion", "category"].reduce((n, key) => n + list(key).length, 0) +
    (params.get("min_price") || params.get("max_price") ? 1 : 0) + (params.get("in_stock") ? 1 : 0) + (params.get("on_sale") ? 1 : 0);

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <fieldset className="border-b hairline py-5">
      <legend className="eyebrow mb-3 float-left w-full">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
  const Check = ({ name, value, label, count }: { name: string; value: string; label: string; count?: number }) => {
    const checked = list(name).includes(value);
    return (
      <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.95rem] text-deep">
        <input type="checkbox" checked={checked} onChange={() => toggle(name, value)} className="peer sr-only" />
        <span className="grid h-5 w-5 place-items-center rounded-md border border-camel bg-white transition peer-checked:border-mocha peer-checked:bg-mocha peer-focus-visible:ring-2 peer-focus-visible:ring-mocha peer-focus-visible:ring-offset-2">
          {checked && <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden><path d="M1 4.5 4 7.5 10 1" stroke="#FFF8F6" strokeWidth="1.8" strokeLinecap="round" /></svg>}
        </span>
        <span className="flex-1">{label}</span>
        {count !== undefined && <span className="text-xs text-mocha">{count}</span>}
      </label>
    );
  };

  const body = facets && (
    <div>
      {showCategories && facets.categories.length > 1 && (
        <Group title="Category">
          {facets.categories.map((c) => <Check key={c.value} name="category" value={c.value} label={c.label} count={c.count} />)}
        </Group>
      )}
      {facets.colors.length > 0 && (
        <Group title="Colour">
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => {
              const checked = list("color").includes(c.value);
              return (
                <button
                  key={c.value} type="button" onClick={() => toggle("color", c.value)} aria-pressed={checked}
                  aria-label={`${c.label} (${c.count})`} title={c.label}
                  className={cn(
                    "h-8 w-8 rounded-full border transition",
                    checked ? "border-mocha ring-2 ring-mocha ring-offset-2 ring-offset-ivory" : "border-sand hover:scale-110",
                  )}
                  style={{ background: c.hex }}
                />
              );
            })}
          </div>
        </Group>
      )}
      <Group title="Price">
        {PRICE_BANDS.map((band) => {
          const checked = (params.get("min_price") ?? "") === band.min && (params.get("max_price") ?? "") === band.max;
          return (
            <label key={band.label} className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.95rem] text-deep">
              <input
                type="radio" name="price" checked={checked} className="h-4 w-4 accent-[#7B4F3A]"
                onChange={() => set({ min_price: band.min, max_price: band.max })}
                onClick={() => checked && set({ min_price: "", max_price: "" })}
              />
              {band.label}
            </label>
          );
        })}
        <p className="mt-1 text-xs text-mocha">Range here: {formatINR(facets.min_price)} – {formatINR(facets.max_price)}</p>
      </Group>
      {facets.sizes.length > 1 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => {
              const checked = list("size").includes(s.value);
              return (
                <button
                  key={s.value} type="button" onClick={() => toggle("size", s.value)} aria-pressed={checked}
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", checked ? "border-mocha bg-mocha text-ivory" : "border-sand bg-white hover:border-mocha")}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </Group>
      )}
      {facets.fabrics.length > 1 && (
        <Group title="Fabric">
          {facets.fabrics.map((f) => <Check key={f.value} name="fabric" value={f.value} label={f.label} count={f.count} />)}
        </Group>
      )}
      {facets.occasions.length > 1 && (
        <Group title="Occasion">
          {facets.occasions.map((o) => <Check key={o.value} name="occasion" value={o.value} label={o.label} count={o.count} />)}
        </Group>
      )}
      <Group title="Availability">
        <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.95rem]">
          <input type="checkbox" className="h-4 w-4 accent-[#7B4F3A]" checked={params.get("in_stock") === "true"} onChange={(e) => set({ in_stock: e.target.checked ? "true" : "" })} />
          In stock only
        </label>
        <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[0.95rem]">
          <input type="checkbox" className="h-4 w-4 accent-[#7B4F3A]" checked={params.get("on_sale") === "true"} onChange={(e) => set({ on_sale: e.target.checked ? "true" : "" })} />
          On sale
        </label>
      </Group>
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className={cn("flex items-center justify-between gap-3 border-y hairline py-3 lg:col-span-2", pending && "opacity-70")}>
        <div className="flex items-center gap-3">
          <button
            type="button" onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full border border-sand px-4 py-2 text-sm text-deep hover:border-mocha lg:hidden"
          >
            <SlidersHorizontal size={15} aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ""}
          </button>
          <p className="text-sm text-mocha" aria-live="polite">{total} {total === 1 ? "piece" : "pieces"}</p>
          {activeCount > 0 && (
            <button type="button" onClick={clear} className="hidden items-center gap-1 text-sm text-mocha underline underline-offset-4 hover:text-deep sm:flex">
              <X size={13} aria-hidden /> Clear filters
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-mocha">
          <span className="hidden sm:inline">Sort by</span>
          <select
            value={params.get("sort") ?? "featured"} onChange={(e) => set({ sort: e.target.value === "featured" ? "" : e.target.value })}
            className="rounded-full border border-sand bg-white px-4 py-2 text-deep outline-none focus:border-mocha" aria-label="Sort products"
          >
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>


      <aside className="hidden lg:sticky lg:top-28 lg:row-start-2 lg:mt-4 lg:block lg:self-start" aria-label="Filters">{body}</aside>

      <Sheet open={open} onClose={() => setOpen(false)} side="left" title="Filters">
        <div className="flex-1 overflow-y-auto px-6">{body}</div>
        <div className="flex gap-3 border-t hairline p-5">
          <Button variant="outline" full onClick={clear}>Clear</Button>
          <Button full onClick={() => setOpen(false)}>Show {total}</Button>
        </div>
      </Sheet>
    </>
  );
}

export function Pagination({ page, pages }: { page: number; pages: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pages <= 1) return null;
  const href = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 1) next.set("page", String(n));
    else next.delete("page");
    const q = next.toString();
    return q ? `${pathname}?${q}` : pathname;
  };
  return (
    <nav className="mt-14 flex items-center justify-center gap-3" aria-label="Pagination">
      {page > 1 && <Button variant="outline" size="sm" href={href(page - 1)}>Previous</Button>}
      <span className="text-sm text-mocha">Page {page} of {pages}</span>
      {page < pages && <Button variant="outline" size="sm" href={href(page + 1)}>Next</Button>}
    </nav>
  );
}
