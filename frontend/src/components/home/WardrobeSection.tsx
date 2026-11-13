"use client";

import { Hand } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Reveal";
import { CanvasGate } from "@/components/three/CanvasGate";
import { useIsMobile, useSite } from "@/lib/hooks";
import type { Collection, Product } from "@/lib/types";
import { cn, formatINR, media } from "@/lib/utils";
import { useUI } from "@/stores/ui";

const WardrobeScene = dynamic(() => import("@/components/three/WardrobeScene"), { ssr: false });

const WOOD_CSS = {
  walnut: "from-[#6b4532] to-[#4a2e20]",
  espresso: "from-[#4a3426] to-[#2e1f16]",
  ivory: "from-[#f1e8dc] to-[#dccdbb]",
} as const;

/**
 * CSS-only wardrobe: perspective doors, a rail you can scroll, garments that swing.
 * This is the poster for the 3D scene and the whole experience where 3D is unavailable.
 */
function Wardrobe2D({
  products, open, wood, onSelect,
}: { products: Product[]; open: boolean; wood: keyof typeof WOOD_CSS; onSelect: (p: Product) => void }) {
  const rail = products.filter((p) => p.wardrobe_placement !== "shelf");
  const shelf = products.filter((p) => p.wardrobe_placement === "shelf");
  const door = cn(
    "absolute top-0 h-full w-1/2 bg-gradient-to-b transition-transform duration-[1600ms] ease-[var(--ease-fabric)] [backface-visibility:hidden]",
    WOOD_CSS[wood],
  );
  return (
    <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-b from-[#efd9d1] to-[#e7cfc6] px-3 pb-[4%] pt-[3%]">
      <div
        className={cn("relative h-full w-full max-w-[900px] rounded-t-[50%_22%] bg-gradient-to-b p-[1.6%] shadow-lift [perspective:1600px]", WOOD_CSS[wood])}
      >
        <div className="relative h-full w-full overflow-hidden rounded-t-[50%_21%] bg-gradient-to-b from-[#fbf1e6] to-cream ring-1 ring-gold/60">
          <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_at_top,rgba(255,214,150,.55),transparent_70%)] transition-opacity duration-[1800ms]", open ? "opacity-100" : "opacity-0")} />
          {/* rail */}
          <div className="absolute left-[4%] right-[4%] top-[23%] h-[5px] rounded-full bg-gradient-to-b from-light-gold to-gold shadow-sm" />
          <ul
            className={cn("no-scrollbar absolute inset-x-[4%] bottom-0 top-[23%] flex snap-x gap-[2%] overflow-x-auto px-[3%] transition-opacity duration-1000", open ? "opacity-100" : "opacity-0")}
            data-lenis-prevent-touch
          >
            {rail.map((product, i) => (
              <li key={product.id} className="h-full w-[23%] min-w-[104px] shrink-0 snap-start">
                <button
                  type="button" onClick={() => onSelect(product)} tabIndex={open ? 0 : -1}
                  className="group flex h-full w-full origin-top animate-[sway_5.5s_ease-in-out_infinite] flex-col items-center hover:[animation-play-state:paused]"
                  style={{ animationDelay: `${i * -0.9}s` }}
                  aria-label={`${product.name}, ${formatINR(product.price)}. Open quick view`}
                >
                  <svg viewBox="0 0 100 34" className="w-[78%] shrink-0 text-gold" aria-hidden>
                    <path d="M46 2c4-3 10 0 8 5-1 3-4 3-4 7l42 15H8L50 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media(product.fabric_texture ?? product.media[0]?.image)} alt="" loading="lazy"
                    className="-mt-[6%] max-h-[72%] w-auto max-w-full object-contain object-top drop-shadow-[0_18px_18px_rgba(61,43,31,.25)] transition-transform duration-700 ease-[var(--ease-fabric)] group-hover:scale-105"
                  />
                  <span className="mt-auto pb-3 text-center opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100">
                    <span className="block font-serif text-sm leading-tight text-deep md:text-base">{product.name}</span>
                    <span className="text-xs font-bold text-deep">{formatINR(product.price)}</span>
                  </span>
                </button>
              </li>
            ))}
            {shelf.map((product) => (
              <li key={product.id} className="flex h-full w-[20%] min-w-[96px] shrink-0 snap-start flex-col justify-end pb-[18%]">
                <button type="button" onClick={() => onSelect(product)} tabIndex={open ? 0 : -1} className="group" aria-label={`${product.name}, folded. Open quick view`}>
                  <span className="mx-auto flex w-[80%] flex-col-reverse gap-[3px] transition-transform duration-500 group-hover:-translate-y-1.5">
                    {product.swatches.slice(0, 4).map((s) => (
                      <span key={s.name} className="h-3 rounded-md shadow-sm md:h-4" style={{ background: s.hex }} />
                    ))}
                  </span>
                  <span className="mt-2 block border-t-4 border-espresso/70 pt-2 font-serif text-sm leading-tight text-deep">{product.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* doors */}
          <div className={cn(door, "left-0 origin-left border-r border-gold/50", open && "[transform:rotateY(-112deg)]")} />
          <div className={cn(door, "right-0 origin-right border-l border-gold/50", open && "[transform:rotateY(112deg)]")} />
        </div>
        <div className="absolute left-1/2 top-[1.2%] -translate-x-1/2 rounded-sm bg-gradient-to-b from-light-gold to-gold px-3 py-0.5 font-serif text-[0.6rem] tracking-[0.3em] text-espresso md:text-xs">
          HAYA &amp; HAZE
        </div>
      </div>
    </div>
  );
}

export function WardrobeSection({
  title, subtitle, products, collections,
}: { title: string; subtitle?: string; products: Product[]; collections: Collection[] }) {
  const site = useSite();
  const mobile = useIsMobile();
  const openQuickView = useUI((s) => s.openQuickView);
  const quickViewOpen = useUI((s) => Boolean(s.quickView));
  const section = useRef<HTMLElement>(null);

  // Tabs: one per collection that has pieces in the wardrobe, in collection order.
  const tabs = useMemo(() => {
    const slugs = new Set(products.map((p) => p.collection?.slug));
    const ordered = collections.filter((c) => slugs.has(c.slug)).map((c) => ({ slug: c.slug, name: c.name }));
    // Lead with the abayas: they show the hanging garments best.
    return ordered.sort((a, b) => Number(b.slug === "covered-edit") - Number(a.slug === "covered-edit"));
  }, [products, collections]);

  const [tab, setTab] = useState(tabs[0]?.slug ?? "");
  const [shown, setShown] = useState(tab);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(-1);
  const current = useMemo(() => products.filter((p) => p.collection?.slug === shown), [products, shown]);
  const railCount = current.filter((p) => p.wardrobe_placement !== "shelf").length;

  // Doors swing open the first time the section is properly in view.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setOpen(true), 500);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Changing category: close the doors, swap the rail, open again.
  const change = (slug: string) => {
    if (slug === tab) return;
    setTab(slug);
    setFocus(-1);
    setOpen(false);
    setTimeout(() => {
      setShown(slug);
      setTimeout(() => setOpen(true), 180);
    }, 850);
  };

  const select = (product: Product) => openQuickView(product, "side");
  const onKeyDown = (event: KeyboardEvent) => {
    if (quickViewOpen || railCount === 0) return;
    if (event.key === "ArrowRight") setFocus((i) => Math.min(railCount - 1, i + 1));
    else if (event.key === "ArrowLeft") setFocus((i) => Math.max(0, i - 1));
    else if ((event.key === "Enter" || event.key === " ") && focus >= 0) {
      event.preventDefault();
      const product = current.filter((p) => p.wardrobe_placement !== "shelf")[focus];
      if (product) select(product);
    }
  };

  if (site && !site.wardrobe_enabled) return null;
  if (products.length === 0) return null;
  const wood = (site?.wardrobe_wood_tone ?? "espresso") as keyof typeof WOOD_CSS;
  const focused = focus >= 0 ? current.filter((p) => p.wardrobe_placement !== "shelf")[focus] : undefined;

  return (
    <section ref={section} className="grain bg-gradient-to-b from-ivory via-[#f6e4de] to-[#efd9d1] pt-20 md:pt-28" aria-label={title}>
      <div className="container-page">
        <SectionHeading eyebrow="Step inside" title={title} text={subtitle} />
        <div className="mt-8 flex justify-center" role="tablist" aria-label="Wardrobe category">
          <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full border hairline bg-ivory/70 p-1 backdrop-blur">
            {tabs.map((t) => (
              <button
                key={t.slug} role="tab" type="button" aria-selected={tab === t.slug} onClick={() => change(t.slug)}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] transition-colors duration-500 md:px-6",
                  tab === t.slug ? "bg-mocha text-ivory" : "text-deep hover:bg-cream",
                )}
              >
                {t.name.replace(/^The /, "")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="relative mx-auto mt-6 aspect-[4/5] max-h-[86svh] w-full max-w-[1500px] outline-none sm:aspect-[4/3] lg:aspect-[16/9]"
        tabIndex={0} role="group" aria-roledescription="wardrobe rail" onKeyDown={onKeyDown} onBlur={() => setFocus(-1)}
        aria-label="The Haya Wardrobe. Use the left and right arrow keys to move along the rail, Enter to open a piece."
      >
        <CanvasGate
          id="wardrobe" className="h-full w-full"
          poster={<Wardrobe2D products={current} open={open} wood={wood} onSelect={(p) => openQuickView(p)} />}
          scene={(controls) => (
            <WardrobeScene
              products={current} mobile={mobile} woodTone={wood} warmth={site?.wardrobe_light_warmth ?? 70}
              open={open} focus={focus} onSelect={select} controls={controls}
            />
          )}
        />
        <p className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ivory/80 px-4 py-2 text-xs text-deep shadow-soft backdrop-blur">
          <Hand size={14} strokeWidth={1.5} aria-hidden /> Drag to slide the rail · tap a piece to try it
        </p>
        <p className="sr-only" aria-live="polite">{focused ? `${focused.name}, ${formatINR(focused.price)}` : ""}</p>
      </div>

      <div className="container-page -mt-2 pb-16 text-center md:pb-20">
        <Button variant="outline" href={`/collections/${tab || "all"}`}>
          View all {tabs.find((t) => t.slug === tab)?.name ?? "pieces"}
        </Button>
      </div>
    </section>
  );
}
