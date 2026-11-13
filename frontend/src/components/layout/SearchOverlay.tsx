"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api/client";
import type { Suggest } from "@/lib/types";
import { formatINR, productImage } from "@/lib/utils";
import { useUI } from "@/stores/ui";

const POPULAR = ["Silk hijab", "Instant hijab", "Black abaya", "Chiffon", "Eid", "Jersey"];

/** Predictive search: results appear as you type; Enter opens the full results page. */
export function SearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const setSearch = useUI((s) => s.setSearch);
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(timer);
  }, [term]);
  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: ({ signal }) => api<Suggest>("/products/suggest/", { params: { q: debounced }, signal }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const close = () => setSearch(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    track("search", { term: term.trim() });
    close();
    router.push(`/search?q=${encodeURIComponent(term.trim())}`);
  };
  const showResults = debounced.length >= 2 && data;

  return (
    <Sheet open={open} onClose={close} side="center" title="Search" hideTitle className="!top-[12vh] !max-w-[720px] !translate-y-0 self-start">
      <form onSubmit={submit} role="search" className="flex items-center gap-3 border-b hairline px-6 py-4 pr-16">
        <Search size={20} strokeWidth={1.4} className="text-mocha" aria-hidden />
        <label htmlFor="site-search" className="sr-only">Search products</label>
        <input
          id="site-search" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus autoComplete="off"
          placeholder="Search hijabs, abayas, fabrics…"
          className="h-12 flex-1 bg-transparent font-serif text-2xl text-deep outline-none placeholder:text-mocha/50"
        />
      </form>
      <div className="max-h-[60vh] overflow-y-auto px-6 py-5" aria-live="polite">
        {!showResults ? (
          <div>
            <p className="eyebrow mb-3">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((word) => (
                <button
                  key={word} type="button" onClick={() => setTerm(word)}
                  className="rounded-full border border-sand px-4 py-2 text-sm text-deep transition hover:border-mocha hover:bg-cream"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        ) : data.products.length === 0 ? (
          <p className="py-6 text-center text-mocha">
            Nothing matched “{debounced}”. Try a fabric, a colour or a collection name.
          </p>
        ) : (
          <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
            {data.collections.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {data.collections.map((c) => (
                  <Link
                    key={c.slug} href={`/collections/${c.slug}`} onClick={close}
                    className="rounded-full bg-cream px-4 py-2 text-sm text-deep hover:bg-sand"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            <ul className="divide-y divide-sand/60">
              {data.products.map((p) => (
                <li key={p.id}>
                  <Link href={`/products/${p.slug}`} onClick={close} className="group flex items-center gap-4 py-3">
                    <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ivory-cream">
                      <Image src={productImage(p)} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-xl leading-tight group-hover:text-mocha">{p.name}</span>
                      <span className="text-xs text-mocha">{p.collection?.name}</span>
                    </span>
                    <span className="text-sm font-bold">{formatINR(p.price)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button" onClick={submit as never}
              className="mt-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-mocha hover:text-deep"
            >
              See all results <ArrowRight size={15} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
