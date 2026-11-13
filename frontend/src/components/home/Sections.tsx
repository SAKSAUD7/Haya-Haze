"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Banknote, Gift, Lock, Plus, Quote, RefreshCcw, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState, type PointerEvent } from "react";

import { NewsletterForm } from "@/components/layout/NewsletterForm";
import { Price, Stars, WaveDivider } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { FABRIC_EASE, Reveal, SectionHeading } from "@/components/ui/Reveal";
import type { CmsImage, Collection, HomeBlock, Look, Product, Review } from "@/lib/types";
import { cn, formatDate, media, productImage } from "@/lib/utils";
import { useUI } from "@/stores/ui";

type Value<T extends HomeBlock["type"]> = Extract<HomeBlock, { type: T }>["value"];

/** An image that ripples like cloth under the cursor (SVG displacement, no WebGL). */
export function FabricRipple({ children, className }: { children: React.ReactNode; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("group/ripple relative overflow-hidden", className)}>
      <svg className="absolute h-0 w-0" aria-hidden>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="4" result="noise">
            <animate attributeName="baseFrequency" dur="9s" values="0.008 0.02;0.012 0.028;0.008 0.02" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div
        className="relative h-full w-full scale-[1.06] transition-transform duration-[1600ms] ease-[var(--ease-fabric)] group-hover/ripple:scale-[1.12] motion-safe:group-hover/ripple:[filter:var(--ripple)]"
        style={{ "--ripple": `url(#${id})` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

function TiltCard({ collection, index }: { collection: Collection; index: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), { stiffness: 120, damping: 16 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-9, 9]), { stiffness: 120, damping: 16 });
  const move = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left) / rect.width - 0.5);
    y.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const leave = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <Reveal delay={index * 0.1} className={cn("[perspective:1200px]", index % 2 === 1 && "md:mt-12")}>
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
        <Link
          href={`/collections/${collection.slug}`} onPointerMove={move} onPointerLeave={leave}
          className="group relative block overflow-hidden rounded-[22px] shadow-soft"
        >
          <FabricRipple className="aspect-[3/4]">
            <Image
              src={media(collection.image)} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover"
            />
          </FabricRipple>
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/75 via-espresso/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-ivory md:p-6" style={{ transform: "translateZ(40px)" }}>
            <span className="mb-2 block h-px w-10 transition-all duration-700 group-hover:w-20" style={{ background: collection.accent_color }} />
            <h3 className="text-2xl !text-ivory md:text-[1.9rem]">{collection.name}</h3>
            <p className="mt-1 hidden text-sm text-cream/90 md:block">{collection.tagline}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-light-gold">
              Explore <ArrowUpRight size={14} className="transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden />
            </span>
          </div>
        </Link>
      </motion.div>
    </Reveal>
  );
}

export function CollectionGrid({ value, collections }: { value: Value<"collection_grid">; collections: Collection[] }) {
  const featured = collections.filter((c) => c.is_featured).slice(0, 4);
  return (
    <section className="py-20 md:py-28" aria-label={value.title}>
      <div className="container-page">
        <SectionHeading eyebrow={value.eyebrow} title={value.title} />
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {featured.map((c, i) => <TiltCard key={c.slug} collection={c} index={i} />)}
        </div>
      </div>
    </section>
  );
}

export function StoryBlock({ value }: { value: Value<"story"> }) {
  return (
    <section className="grain relative overflow-hidden bg-forest py-24 text-ivory md:py-36" aria-label={value.eyebrow}>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full border border-gold/25" />
        <div className="absolute -right-10 -top-10 h-[320px] w-[320px] rounded-full border border-gold/15" />
        <p className="absolute -bottom-10 left-6 select-none font-serif text-[15rem] leading-none text-ivory/[0.045] md:text-[24rem]" lang="ar" dir="rtl">حياء</p>
      </div>
      <div className="container-page relative">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-8 !text-light-gold">{value.eyebrow}</p>
          <blockquote className="font-display text-[2rem] italic leading-[1.22] text-ivory md:text-[3.5rem]">
            “{value.quote}”
          </blockquote>
          {value.body && <p className="mx-auto mt-8 max-w-2xl text-[1.05rem] text-cream/85">{value.body}</p>}
          {value.cta_label && (
            <div className="mt-10">
              <Button href={value.cta_link} variant="gold" magnetic>{value.cta_label}</Button>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export function LuxeSpotlight({ value, product }: { value: Value<"luxe_spotlight">; product?: Product }) {
  const openQuickView = useUI((s) => s.openQuickView);
  return (
    <section className="grain overflow-hidden bg-champagne py-20 md:py-28" aria-label={value.title}>
      <div className="container-page grid items-center gap-12 md:grid-cols-2 md:gap-20">
        <Reveal className="relative mx-auto w-full max-w-[460px]">
          <div className="absolute -inset-4 rounded-t-[240px] rounded-b-[26px] border border-gold/60" aria-hidden />
          <div className="absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-light-gold/60 blur-3xl" aria-hidden />
          {product && (
            <FabricRipple className="aspect-[3/4] rounded-t-[230px] rounded-b-[20px] shadow-lift">
              <Image src={productImage(product)} alt={product.name} fill sizes="(max-width: 768px) 90vw, 460px" className="object-cover" />
            </FabricRipple>
          )}
        </Reveal>
        <Reveal delay={0.15}>
          <p className="eyebrow mb-5 !text-gold-ink">{value.eyebrow}</p>
          <h2 className="text-4xl md:text-[3.6rem]">{value.title}</h2>
          <WaveDivider className="my-6 max-w-[220px]" />
          {value.text && <p className="max-w-md text-[1.05rem] text-mocha">{value.text}</p>}
          {product && (
            <div className="mt-7 flex items-center gap-4 rounded-2xl border border-gold/40 bg-ivory/70 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/products/${product.slug}`} className="font-serif text-2xl leading-tight hover:text-mocha">{product.name}</Link>
                <div className="mt-1"><Price price={product.price} compareAt={product.compare_at_price} /></div>
              </div>
              <button
                type="button" onClick={() => openQuickView(product)} aria-label={`Quick view ${product.name}`}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-espresso transition hover:bg-light-gold"
              >
                <Plus size={20} />
              </button>
            </div>
          )}
          <div className="mt-8">
            <Button href={value.cta_link} magnetic>{value.cta_label}</Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LookImage({ look, products, priority = false }: { look: Look; products: Product[]; priority?: boolean }) {
  const openQuickView = useUI((s) => s.openQuickView);
  const [active, setActive] = useState<number | null>(null);
  if (!look.image) return null;
  return (
    <figure className="relative">
      <div className="relative overflow-hidden rounded-[22px] bg-cream shadow-soft" style={{ aspectRatio: `${look.image.width} / ${look.image.height}` }}>
        <Image src={look.image.url} alt={look.title || look.image.alt} fill sizes="(max-width: 768px) 100vw, 640px" className="object-cover" priority={priority} />
        {look.hotspots.map((spot, i) => {
          const product = products.find((p) => p.slug === spot.product);
          if (!product) return null;
          const open = active === i;
          return (
            <div key={i} className="absolute" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
              <button
                type="button" aria-expanded={open} aria-label={`Shop ${product.name}`}
                onClick={() => setActive(open ? null : i)}
                className="relative -ml-4 -mt-4 grid h-8 w-8 place-items-center rounded-full bg-ivory text-deep shadow-lift transition-transform duration-500 hover:scale-110"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-ivory/70 [animation-duration:2.6s]" aria-hidden />
                <Plus size={15} className={cn("relative transition-transform duration-500", open && "rotate-45")} />
              </button>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: FABRIC_EASE }}
                  className={cn("absolute top-7 z-10 w-52 rounded-2xl bg-ivory p-3 shadow-lift", spot.x > 55 ? "right-0" : "left-0")}
                >
                  <p className="font-serif text-lg leading-tight">{product.name}</p>
                  <Price price={product.price} compareAt={product.compare_at_price} size="sm" />
                  <button
                    type="button" onClick={() => openQuickView(product)}
                    className="mt-2 w-full rounded-full bg-mocha py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-ivory hover:bg-deep"
                  >
                    Quick view
                  </button>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
      {(look.title || look.caption) && (
        <figcaption className="mt-4 px-1">
          <span className="block font-serif text-2xl">{look.title}</span>
          <span className="text-sm text-mocha">{look.caption}</span>
        </figcaption>
      )}
    </figure>
  );
}

export function LookbookBlock({ value, products }: { value: Value<"lookbook">; products: Product[] }) {
  return (
    <section className="py-20 md:py-28" aria-label={value.title}>
      <div className="container-page">
        <SectionHeading eyebrow={value.eyebrow} title={value.title} />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {value.looks.map((look, i) => (
            <Reveal key={i} delay={i * 0.12}><LookImage look={look} products={products} /></Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button variant="outline" href="/lookbook">See the lookbook</Button>
        </div>
      </div>
    </section>
  );
}

export function ReviewsCarousel({ value, reviews }: { value: Value<"reviews">; reviews: Review[] }) {
  if (reviews.length === 0) return null;
  return (
    <section className="grain overflow-hidden bg-cream py-20 md:py-28" aria-label={value.title}>
      <div className="container-page">
        <SectionHeading eyebrow={value.eyebrow} title={value.title} />
      </div>
      <ul className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:px-[max(40px,calc((100vw-1320px)/2+40px))]" data-lenis-prevent-touch>
        {reviews.map((review, i) => (
          <Reveal as="li" key={review.id} delay={Math.min(i, 4) * 0.08} className="w-[84vw] max-w-[400px] shrink-0 snap-center">
            <article className="flex h-full flex-col rounded-[22px] border hairline bg-ivory p-7 shadow-soft">
              <Quote size={26} className="text-camel" aria-hidden />
              <Stars value={review.rating} className="mt-4" />
              {review.title && <h3 className="mt-3 text-2xl">{review.title}</h3>}
              <p className="mt-2 flex-1 text-[0.98rem] text-mocha">{review.body}</p>
              <footer className="mt-5 border-t hairline pt-4 text-sm">
                <p className="font-bold text-deep">
                  {review.name}{review.location ? `, ${review.location}` : ""}
                  {review.is_verified_buyer && <span className="ml-2 text-xs font-normal text-success">Verified buyer</span>}
                </p>
                <p className="text-xs text-mocha">
                  on <Link href={`/products/${review.product_slug}`} className="underline underline-offset-4">{review.product_name}</Link> · {formatDate(review.created_at)}
                </p>
              </footer>
            </article>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export function UGCGrid({ value }: { value: Value<"ugc_grid"> }) {
  const images = value.images.filter((i): i is CmsImage => Boolean(i));
  if (images.length === 0) return null;
  return (
    <section className="py-20 md:py-28" aria-label={value.title}>
      <div className="container-page">
        <SectionHeading eyebrow={value.hashtag} title={value.title} text="Tag us to be featured. We love seeing how you make each piece your own." />
        <div className="mt-12 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
          {images.map((image, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <a
                href={value.link} target="_blank" rel="noopener noreferrer" aria-label={`${value.hashtag} on Instagram, photo ${i + 1}`}
                className="group relative block aspect-square overflow-hidden rounded-2xl bg-cream"
              >
                <Image src={image.url} alt="" fill sizes="(max-width: 768px) 33vw, 16vw" className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-fabric)] group-hover:scale-110" />
                <span className="absolute inset-0 grid place-items-center bg-espresso/0 text-ivory opacity-0 transition duration-500 group-hover:bg-espresso/35 group-hover:opacity-100">
                  <ArrowUpRight size={22} aria-hidden />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const TRUST_ICONS = { truck: Truck, returns: RefreshCcw, cash: Banknote, lock: Lock, gift: Gift } as const;

export function TrustStrip({ value }: { value: Value<"trust_strip"> }) {
  return (
    <section className="border-y hairline bg-ivory-cream py-10" aria-label="Why shop with us">
      <ul className="container-page grid grid-cols-2 gap-y-8 md:grid-cols-4">
        {value.items.map((item, i) => {
          const Icon = TRUST_ICONS[item.icon as keyof typeof TRUST_ICONS] ?? Gift;
          return (
            <Reveal as="li" key={i} delay={i * 0.08} className="flex flex-col items-center px-3 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-gold/50 text-mocha">
                <Icon size={20} strokeWidth={1.4} aria-hidden />
              </span>
              <p className="mt-3 font-serif text-xl text-deep">{item.title}</p>
              <p className="text-sm text-mocha">{item.text}</p>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}

export function NewsletterBlock({ value }: { value: Value<"newsletter"> }) {
  return (
    <section className="grain bg-blush py-20 md:py-24" aria-label={value.title}>
      <Reveal className="container-page mx-auto max-w-xl text-center">
        <h2 className="text-4xl md:text-5xl">{value.title}</h2>
        {value.text && <p className="mx-auto mt-4 max-w-md text-mocha">{value.text}</p>}
        <div className="mx-auto mt-8 max-w-md"><NewsletterForm source="home" /></div>
      </Reveal>
    </section>
  );
}
