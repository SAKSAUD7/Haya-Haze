"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState, type KeyboardEvent } from "react";

import { Swatches } from "@/components/product/VariantPicker";
import { Price } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { FABRIC_EASE, WordReveal } from "@/components/ui/Reveal";
import { CanvasGate } from "@/components/three/CanvasGate";
import type { RingApi } from "@/components/three/HeroScene";
import { useIsMobile } from "@/lib/hooks";
import type { HomeBlock, Product } from "@/lib/types";
import { cn, media } from "@/lib/utils";
import { useUI } from "@/stores/ui";

// The 3D bundle (three.js + scene) is loaded only in the browser, only when needed.
const HeroScene = dynamic(() => import("@/components/three/HeroScene"), { ssr: false });

type HeroValue = Extract<HomeBlock, { type: "hero_3d" }>["value"];

/**
 * 2D version of the Top Picks carousel. Server-rendered as the poster, and the full
 * experience where 3D is unavailable: cut-outs drift and flutter with CSS alone.
 */
function Hero2D({ products, active, onPick }: { products: Product[]; active: number; onPick: (index: number) => void }) {
  const count = products.length;
  const slots = [-1, 0, 1].map((offset) => ((active + offset) % count + count) % count);
  return (
    <div className="absolute inset-0 flex items-center justify-center md:left-[46%] md:pb-24">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,228,176,.7),transparent_65%)] blur-2xl" />
      {slots.map((index, position) => {
        const product = products[index];
        const centre = position === 1;
        const src = media(product.fabric_texture ?? product.media[0]?.image);
        return (
          <motion.button
            key={product.id} type="button" layout
            onClick={() => onPick(index)}
            aria-label={centre ? `Quick view ${product.name}` : `Show ${product.name}`}
            className={cn("absolute aspect-[3/4] h-[62%] md:h-[66%]", centre ? "z-10" : "z-0")}
            animate={{ x: `${(position - 1) * 78}%`, scale: centre ? 1 : 0.62, opacity: centre ? 1 : 0.5, rotate: (position - 1) * 5 }}
            transition={{ duration: 1, ease: FABRIC_EASE }}
          >
            <span className="block h-full w-full animate-[drift_9s_ease-in-out_infinite]" style={{ animationDelay: `${position * -2}s` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src} alt={centre ? product.name : ""} loading={centre ? "eager" : "lazy"} fetchPriority={centre ? "high" : undefined}
                className={cn("h-full w-full origin-top animate-[flutter_7s_ease-in-out_infinite] object-contain drop-shadow-[0_30px_40px_rgba(74,44,42,.22)]", !product.fabric_texture && "rounded-3xl object-cover")}
              />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function HeroSection({ value, products }: { value: HeroValue; products: Product[] }) {
  const mobile = useIsMobile();
  const openQuickView = useUI((s) => s.openQuickView);
  const [active, setActive] = useState(0);
  const ring = useRef<RingApi | null>(null);
  const lines = (value.headline || "").split("\n").filter(Boolean);
  const count = products.length;
  const current = products[active % Math.max(count, 1)];

  const step = (direction: 1 | -1) => {
    if (ring.current) ring.current.step(direction);
    else setActive((i) => ((i + direction) % count + count) % count);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowLeft") step(-1);
    else if ((event.key === "Enter" || event.key === " ") && current) {
      event.preventDefault();
      openQuickView(current);
    }
  };

  return (
    <section
      className="grain relative -mt-[68px] overflow-hidden bg-gradient-to-b from-blush via-[#f8e3df] to-ivory pt-[68px] md:-mt-20 md:pt-20"
      aria-label="Top picks"
    >
      {/* haze */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-ivory/70 blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[620px] rounded-full bg-light-gold/30 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-104px)] max-w-[1480px] flex-col md:min-h-[max(640px,calc(100svh-116px))] md:flex-row md:items-center">
        {/* Copy. Sits above the canvas; only its links take pointer events so drags reach the ring. */}
        <div className="pointer-events-none relative z-10 px-5 pt-10 md:w-[46%] md:px-10 md:pt-0 lg:pl-16">
          <motion.p
            className="eyebrow mb-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.1 }}
          >
            Hijab &amp; Abaya · Est. 2025
          </motion.p>
          <h1 className="text-[2.7rem] leading-[1.02] sm:text-6xl lg:text-[4.6rem]">
            {lines.map((line, i) => (
              <span key={i} className={cn("block", i === lines.length - 1 && "mt-2 font-display text-[0.62em] italic text-mocha")}>
                <WordReveal text={line} delay={0.15 + i * 0.32} />
              </span>
            ))}
          </h1>
          {value.subtext && (
            <motion.p
              className="mt-6 max-w-md text-[1.05rem] text-mocha"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 1.1, ease: FABRIC_EASE }}
            >
              {value.subtext}
            </motion.p>
          )}
          <motion.div
            className="pointer-events-auto mt-8 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, delay: 1.3, ease: FABRIC_EASE }}
          >
            <Button href={value.primary_cta_link} size="lg" magnetic>{value.primary_cta_label}</Button>
            <Button href={value.secondary_cta_link} size="lg" variant="camel" magnetic>{value.secondary_cta_label}</Button>
          </motion.div>
        </div>

        {/* The ring */}
        {count > 0 && (
          <div
            className="relative min-h-[430px] flex-1 outline-none md:absolute md:inset-0 md:min-h-0"
            tabIndex={0} role="group" aria-roledescription="carousel"
            aria-label="Top picks. Use the left and right arrow keys to browse, Enter to open a product."
            onKeyDown={onKeyDown}
          >
            <CanvasGate
              id="hero" className="h-full min-h-[430px] w-full md:absolute md:inset-0 md:[mask-image:linear-gradient(to_right,transparent_26%,black_50%)]"
              poster={<Hero2D products={products} active={active} onPick={(i) => (i === active ? openQuickView(products[i]) : setActive(i))} />}
              scene={(controls) => (
                <HeroScene
                  products={products} mobile={mobile} api={ring} onActive={setActive}
                  onSelect={(product) => openQuickView(product)} controls={controls}
                />
              )}
            />
          </div>
        )}

        {/* Label for the piece at the front, with the same controls for keyboard and touch */}
        {current && (
          <div className="pointer-events-none relative z-10 px-5 pb-8 md:absolute md:bottom-10 md:right-10 md:w-[340px] md:px-0 md:pb-0 lg:right-16">
            <div className="pointer-events-auto rounded-[22px] border hairline bg-ivory/75 p-4 shadow-soft backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Top pick {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</p>
                <div className="flex gap-1.5">
                  <button
                    type="button" onClick={() => step(-1)} aria-label="Previous pick"
                    className="grid h-9 w-9 place-items-center rounded-full border border-sand text-deep transition hover:border-mocha hover:bg-cream"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button" onClick={() => step(1)} aria-label="Next pick"
                    className="grid h-9 w-9 place-items-center rounded-full border border-sand text-deep transition hover:border-mocha hover:bg-cream"
                  >
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id} aria-live="polite"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.45, ease: FABRIC_EASE }}
                >
                  <p className="mt-2 font-serif text-2xl leading-tight text-deep">{current.name}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <Price price={current.price} compareAt={current.compare_at_price} />
                    <Swatches swatches={current.swatches} />
                  </div>
                  <p className="mt-1 text-xs text-mocha">{current.fabric_label} · {current.fabric_feel}</p>
                </motion.div>
              </AnimatePresence>
              <Button size="sm" full className="mt-3" onClick={() => openQuickView(current)}>Quick view &amp; add to bag</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
