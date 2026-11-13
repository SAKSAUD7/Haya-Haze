"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Banknote, Check, ChevronDown, MapPin, RefreshCcw, Share2, Sparkles, Truck, Wind } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { toast } from "sonner";

import { Badge, Price, Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { CanvasGate } from "@/components/three/CanvasGate";
import { track } from "@/lib/analytics";
import { api, errorMessage } from "@/lib/api/client";
import { useAddToCart, useSite } from "@/lib/hooks";
import type { Pincode, Product, ProductDetail } from "@/lib/types";
import { cn, formatINR, media, uniq } from "@/lib/utils";
import { useRecent } from "@/stores/ui";

import { ProductCard, WishlistButton } from "./ProductCard";
import { QuantityStepper } from "./QuickView";
import { useVariantSelection, VariantPicker } from "./VariantPicker";

const FabricViewer = dynamic(() => import("@/components/three/FabricViewer"), { ssr: false });

// --- Gallery -------------------------------------------------------------------------------
function Gallery({ product, color }: { product: ProductDetail; color: string }) {
  const images = product.media.filter((m) => m.image);
  // The chosen colour's photos first, then shared shots (details), then other colours.
  const ordered = [
    ...images.filter((m) => m.color_name === color),
    ...images.filter((m) => !m.color_name),
    ...images.filter((m) => m.color_name && m.color_name !== color),
  ];
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => setIndex(0), [color]);
  const current = ordered[Math.min(index, ordered.length - 1)];

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
  };

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row md:gap-4">
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto md:max-h-[640px] md:w-[76px] md:flex-col md:overflow-y-auto" role="tablist" aria-label="Product images">
        {ordered.map((m, i) => (
          <button
            key={m.id} type="button" role="tab" aria-selected={!live && i === index} aria-label={m.alt_text || `Image ${i + 1}`}
            onClick={() => {
              setIndex(i);
              setLive(false);
            }}
            className={cn(
              "relative aspect-[3/4] w-[64px] shrink-0 overflow-hidden rounded-xl border-2 transition md:w-full",
              !live && i === index ? "border-mocha" : "border-transparent opacity-75 hover:opacity-100",
            )}
          >
            <Image src={media(m.image)} alt="" fill sizes="76px" className="object-cover" />
          </button>
        ))}
        {product.fabric_texture && (
          <button
            type="button" role="tab" aria-selected={live} onClick={() => setLive(true)}
            className={cn(
              "grid aspect-[3/4] w-[64px] shrink-0 place-items-center rounded-xl border-2 bg-blush/70 text-deep transition md:w-full",
              live ? "border-mocha" : "border-transparent hover:border-camel",
            )}
          >
            <span className="flex flex-col items-center gap-1 px-1 text-center text-[0.58rem] font-bold uppercase leading-tight tracking-[0.1em]">
              <Wind size={18} strokeWidth={1.4} aria-hidden /> Feel the fabric
            </span>
          </button>
        )}
      </div>

      <div className="relative min-w-0 flex-1">
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-[22px] bg-ivory-cream md:cursor-zoom-in"
          onPointerMove={live ? undefined : onMove} onPointerLeave={() => setZoom(null)}
        >
          {live && product.fabric_texture ? (
            <div className="absolute inset-0 bg-gradient-to-b from-blush/70 to-ivory">
              <CanvasGate
                id="fabric-viewer" className="h-full w-full"
                poster={
                  <div className="absolute inset-0 grid place-items-center p-8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media(product.fabric_texture)} alt={product.name} className="max-h-full animate-[flutter_7s_ease-in-out_infinite] object-contain" />
                  </div>
                }
                scene={(controls) => (
                  <FabricViewer url={media(product.fabric_texture)} fabric={product.fabric} shape={product.shape_preset} controls={controls} />
                )}
              />
              <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-mocha">
                <span className="rounded-full bg-ivory/85 px-4 py-2 shadow-soft backdrop-blur">
                  {product.fabric_label} · {product.fabric_feel} — drag to watch it move
                </span>
              </p>
            </div>
          ) : (
            current && (
              <Image
                key={current.id} src={media(current.image)} alt={current.alt_text || product.name} fill priority
                sizes="(max-width: 768px) 100vw, 620px"
                className="object-cover transition-transform duration-300 ease-out"
                style={zoom ? { transform: "scale(2.1)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            )
          )}
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-1.5">
            {product.discount_percent > 0 && <Badge tone="mocha">{product.discount_percent}% off</Badge>}
            {product.is_new && <Badge>New</Badge>}
            {product.is_bestseller && <Badge tone="gold">Bestseller</Badge>}
          </div>
          <WishlistButton product={product} className="absolute right-4 top-4" />
        </div>
      </div>
    </div>
  );
}

// --- Pincode checker ----------------------------------------------------------------------
function PincodeChecker() {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<Pincode | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("hh-pincode");
      if (saved) setPincode(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const check = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api<Pincode>(`/shipping/pincode/${encodeURIComponent(pincode.trim() || "0")}/`);
      setResult(data);
      if (data.serviceable) localStorage.setItem("hh-pincode", data.pincode);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border hairline bg-ivory-cream/70 p-4">
      <form onSubmit={check} className="flex items-center gap-2">
        <MapPin size={18} strokeWidth={1.4} className="shrink-0 text-mocha" aria-hidden />
        <label htmlFor="pincode-check" className="sr-only">Delivery pincode</label>
        <input
          id="pincode-check" inputMode="numeric" maxLength={6} value={pincode} placeholder="Enter pincode for delivery date"
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-deep outline-none placeholder:text-mocha/70"
        />
        <button type="submit" disabled={busy || pincode.length !== 6} className="text-xs font-bold uppercase tracking-[0.14em] text-mocha hover:text-deep disabled:opacity-40">
          {busy ? "Checking" : "Check"}
        </button>
      </form>
      {result && (
        <div className="mt-3 border-t hairline pt-3 text-sm" role="status">
          {result.serviceable ? (
            <ul className="space-y-1.5 text-deep">
              <li className="flex items-center gap-2">
                <Truck size={15} className="text-success" aria-hidden />
                <span>Standard delivery {result.city && `to ${result.city} `}by <b>{result.standard_eta.split(" – ").pop()}</b></span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles size={15} className="text-success" aria-hidden />
                <span>Express by <b>{result.express_eta.split(" – ").pop()}</b></span>
              </li>
              <li className="flex items-center gap-2">
                <Banknote size={15} className={result.cod_available ? "text-success" : "text-mocha"} aria-hidden />
                {result.cod_available ? "Cash on Delivery available" : "Cash on Delivery is not available here; prepaid only"}
              </li>
            </ul>
          ) : (
            <p className="text-danger">{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BackInStock({ variantId }: { variantId: number }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api("/back-in-stock/", { method: "POST", body: { variant_id: variantId, email } });
      setDone(true);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  if (done) return <p className="flex items-center gap-2 text-sm text-success" role="status"><Check size={16} /> We will email you the moment it is back.</p>;
  return (
    <form onSubmit={submit} className="rounded-2xl bg-cream p-4">
      <p className="mb-2 text-sm text-deep">This option is sold out. Leave your email and we will tell you when it returns.</p>
      <div className="flex gap-2">
        <label htmlFor="bis-email" className="sr-only">Email address</label>
        <input id="bis-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="field !py-2.5" />
        <Button type="submit" size="sm">Notify me</Button>
      </div>
    </form>
  );
}

function SizeGuide({ open, onClose, guide }: { open: boolean; onClose: () => void; guide: string }) {
  const rows = guide.split("\n").map((r) => r.split("|").map((c) => c.trim())).filter((r) => r.length > 1);
  return (
    <Sheet open={open} onClose={onClose} side="center" title="Size guide" className="!max-w-[640px]">
      <div className="overflow-y-auto px-6 pb-8">
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border hairline">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream text-xs uppercase tracking-[0.12em] text-mocha">
                <tr>{rows[0].map((cell) => <th key={cell} scope="col" className="px-4 py-3 font-bold">{cell}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, i) => (
                  <tr key={i} className="border-t border-sand/70">
                    {row.map((cell, j) => <td key={j} className={cn("px-4 py-3", j === 0 && "font-bold text-deep")}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-mocha">{guide || "One size fits most."}</p>
        )}
        <p className="mt-4 text-sm text-mocha">
          Between sizes? Choose by length first. See the full <Link href="/size-guide" className="underline underline-offset-4">size guide</Link> or message us on WhatsApp.
        </p>
      </div>
    </Sheet>
  );
}

// --- Main ------------------------------------------------------------------------------------
export function ProductView({ product }: { product: ProductDetail }) {
  const selection = useVariantSelection(product);
  const { variant, color } = selection;
  const site = useSite();
  const router = useRouter();
  const { addToCart, pending } = useAddToCart();
  const [quantity, setQuantity] = useState(1);
  const [guide, setGuide] = useState(false);
  const [stuck, setStuck] = useState(false);
  const buyBox = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const soldOut = !variant || variant.available <= 0;
  const price = variant?.price ?? product.price;
  const compareAt = variant?.compare_at_price ?? product.compare_at_price;

  useEffect(() => {
    useRecent.getState().push(product.slug);
    track("view_item", { product });
  }, [product]);

  // Sticky bar on mobile once the main button has scrolled away.
  useEffect(() => {
    const el = buyBox.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const add = () => addToCart(product, variant, { quantity, from: galleryRef.current, image: product.media.find((m) => m.color_name === color)?.image ?? undefined });
  const buyNow = async () => {
    if (await addToCart(product, variant, { quantity, silent: true })) router.push("/checkout");
  };
  const share = async () => {
    const data = { title: product.name, text: product.subtitle, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else {
      await navigator.clipboard?.writeText(data.url);
      toast.success("Link copied");
    }
  };

  const sections = [
    { id: "description", title: "Description", html: <p>{product.description}</p> },
    {
      id: "fabric", title: "Fabric & care",
      html: (
        <>
          <p><b>{product.fabric_label}</b> · {product.fabric_feel}. {product.occasion_label && `Lovely for ${product.occasion_label.toLowerCase()} wear.`}</p>
          <p className="mt-2">{product.fabric_care}</p>
        </>
      ),
    },
    {
      id: "shipping", title: "Shipping & returns",
      html: (
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Free standard shipping on orders above {formatINR(site?.free_shipping_threshold ?? 1499)}.</li>
          <li>Standard {site?.standard_delivery_days ?? "5-7"} working days · Express {site?.express_delivery_days ?? "2-3"} working days.</li>
          <li>Cash on Delivery available on most pincodes.</li>
          <li>Easy returns and exchanges within 7 days of delivery.</li>
        </ul>
      ),
    },
  ];

  return (
    <>
      <div className="grid gap-8 md:grid-cols-[1.08fr_1fr] md:gap-12 lg:gap-16">
        <div ref={galleryRef} className="min-w-0 md:sticky md:top-28 md:self-start">
          <Gallery product={product} color={color} />
        </div>

        <div className="min-w-0">
          <p className="eyebrow mb-3">{product.collection?.name}</p>
          <h1 className="text-4xl md:text-[3.2rem]">{product.name}</h1>
          {product.subtitle && <p className="mt-2 text-lg text-mocha">{product.subtitle}</p>}
          {product.rating_count > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-mocha hover:text-deep">
              <Stars value={product.rating_average} /> {Number(product.rating_average).toFixed(1)} · {product.rating_count} review{product.rating_count === 1 ? "" : "s"}
            </a>
          )}
          <div className="mt-5">
            <Price price={price} compareAt={compareAt} size="lg" />
            <p className="mt-1 text-xs text-mocha">Inclusive of all taxes</p>
          </div>

          <div className="my-7 border-t hairline pt-7">
            <VariantPicker selection={selection} onSizeGuide={product.size_guide ? () => setGuide(true) : undefined} />
          </div>

          {!soldOut && variant?.is_low_stock && (
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-dusty">
              <span className="h-2 w-2 animate-pulse rounded-full bg-dusty" aria-hidden /> Only {variant.available} left in this option
            </p>
          )}

          <div ref={buyBox} className="space-y-3">
            {soldOut && variant ? (
              <BackInStock key={variant.id} variantId={variant.id} />
            ) : (
              <>
                <div className="flex gap-3">
                  <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, variant?.available ?? 1)} />
                  <Button full size="lg" onClick={add} loading={pending} magnetic>Add to bag<span className="hidden sm:inline">&nbsp;· {formatINR(Number(price) * quantity)}</span></Button>
                </div>
                <Button full size="lg" variant="camel" onClick={buyNow} disabled={pending}>Buy it now</Button>
              </>
            )}
          </div>

          <div className="mt-5"><PincodeChecker /></div>

          <ul className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-mocha">
            {[[Truck, "Free shipping over " + formatINR(site?.free_shipping_threshold ?? 1499)], [Banknote, "Cash on Delivery"], [RefreshCcw, "7-day easy returns"]].map(([Icon, label], i) => {
              const I = Icon as typeof Truck;
              return (
                <li key={i} className="flex flex-col items-center gap-1.5 rounded-xl bg-cream/70 px-2 py-3">
                  <I size={18} strokeWidth={1.4} aria-hidden /> {label as string}
                </li>
              );
            })}
          </ul>

          <Accordion.Root type="multiple" defaultValue={["description"]} className="mt-7 border-t hairline">
            {sections.map((section) => (
              <Accordion.Item key={section.id} value={section.id} className="border-b hairline">
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between py-4 text-left font-serif text-2xl text-deep">
                    {section.title}
                    <ChevronDown size={18} strokeWidth={1.5} className="transition-transform duration-500 group-data-[state=open]:rotate-180" aria-hidden />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden pb-5 text-[0.98rem] leading-relaxed text-mocha">{section.html}</Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>

          <div className="mt-5 flex items-center justify-between text-sm text-mocha">
            <span>SKU {variant?.sku}</span>
            <button type="button" onClick={share} className="flex items-center gap-2 hover:text-deep">
              <Share2 size={15} aria-hidden /> Share
            </button>
          </div>
        </div>
      </div>

      <SizeGuide open={guide} onClose={() => setGuide(false)} guide={product.size_guide} />

      {/* Sticky add-to-bag bar on small screens */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t hairline bg-ivory/95 px-4 py-3 backdrop-blur-xl transition-transform duration-500 ease-[var(--ease-fabric)] md:hidden",
          stuck ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!stuck}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg leading-tight">{product.name}</p>
          <p className="text-sm font-bold">{formatINR(price)} <span className="font-normal text-mocha">{variant?.label}</span></p>
        </div>
        <Button onClick={add} loading={pending} disabled={soldOut} tabIndex={stuck ? 0 : -1}>{soldOut ? "Sold out" : "Add to bag"}</Button>
      </div>
    </>
  );
}

export function RecentlyViewed({ exclude }: { exclude: string }) {
  const slugs = useRecent((s) => s.slugs).filter((s) => s !== exclude).slice(0, 4);
  const { data } = useQuery({
    queryKey: ["recent", slugs],
    queryFn: async () => (await Promise.all(slugs.map((slug) => api<Product>(`/products/${slug}/`).catch(() => null)))).filter((p): p is Product => Boolean(p)),
    enabled: slugs.length > 0,
    staleTime: 120_000,
  });
  if (!data?.length) return null;
  return (
    <section className="py-14" aria-label="Recently viewed">
      <h2 className="mb-8 text-3xl md:text-4xl">Recently viewed</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {uniq(data).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
