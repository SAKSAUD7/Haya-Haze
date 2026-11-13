"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import type { Product } from "@/lib/types";

import { ProductCard } from "./ProductCard";

/** Horizontally scrolling product rail: swipe on touch, arrows with a pointer or keyboard. */
export function ProductCarousel({
  products, eyebrow, title, cta,
}: { products: Product[]; eyebrow?: string; title: string; cta?: { label: string; href: string } }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<"start" | "middle" | "end">("start");

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    if (el.scrollLeft < 8) setEdge("start");
    else if (el.scrollLeft + el.clientWidth > el.scrollWidth - 8) setEdge("end");
    else setEdge("middle");
  };

  if (products.length === 0) return null;
  return (
    <section className="py-16 md:py-24" aria-label={title}>
      <div className="container-page">
        <Reveal className="mb-9 flex items-end justify-between gap-6">
          <div>
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            <h2 className="text-4xl md:text-5xl">{title}</h2>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button" onClick={() => scroll(-1)} disabled={edge === "start"} aria-label="Previous products"
              className="grid h-11 w-11 place-items-center rounded-full border border-sand text-deep transition hover:border-mocha hover:bg-cream disabled:opacity-35"
            >
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button" onClick={() => scroll(1)} disabled={edge === "end"} aria-label="More products"
              className="grid h-11 w-11 place-items-center rounded-full border border-sand text-deep transition hover:border-mocha hover:bg-cream disabled:opacity-35"
            >
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>
          </div>
        </Reveal>
      </div>
      <div
        ref={track} onScroll={onScroll} data-lenis-prevent-touch
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-2 md:gap-6 md:px-[max(40px,calc((100vw-1320px)/2+40px))]"
      >
        {products.map((p, i) => (
          <Reveal key={p.id} delay={Math.min(i, 4) * 0.07} className="w-[62vw] shrink-0 snap-start sm:w-[38vw] md:w-[28vw] lg:w-[292px]">
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
      {cta?.label && (
        <div className="container-page mt-10 text-center">
          <Button variant="outline" href={cta.href}>{cta.label}</Button>
        </div>
      )}
    </section>
  );
}
