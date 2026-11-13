"use client";

import { Eye, Heart, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import { Badge, Price, Stars } from "@/components/ui/bits";
import { useAddToCart, useMounted, useWishlistToggle } from "@/lib/hooks";
import type { Product } from "@/lib/types";
import { cn, firstAvailable, hoverImage, productImage } from "@/lib/utils";
import { useUI } from "@/stores/ui";

import { Swatches } from "./VariantPicker";

export function WishlistButton({ product, className }: { product: Pick<Product, "id" | "name">; className?: string }) {
  const { ids, toggle } = useWishlistToggle();
  const mounted = useMounted();
  const active = mounted && ids.includes(product.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        toggle(product);
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-full bg-ivory/90 text-deep shadow-sm backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-ivory",
        className,
      )}
    >
      <Heart size={17} strokeWidth={1.6} className={cn("transition-colors", active && "fill-deep-blush text-deep-blush")} />
    </button>
  );
}

export function ProductCard({ product, priority = false, className }: { product: Product; priority?: boolean; className?: string }) {
  const openQuickView = useUI((s) => s.openQuickView);
  const { addToCart, pending } = useAddToCart();
  const imageRef = useRef<HTMLDivElement>(null);
  const primary = productImage(product);
  const secondary = hoverImage(product);
  const href = `/products/${product.slug}`;
  // One purchasable option: add straight to the bag. Otherwise ask which one.
  const single = product.variants.length === 1 ? firstAvailable(product.variants) : undefined;

  const quickAdd = () => {
    if (single) addToCart(product, single, { from: imageRef.current, image: primary });
    else openQuickView(product);
  };

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div ref={imageRef} className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-card)] bg-ivory-cream">
        <Link href={href} className="absolute inset-0" aria-label={product.name} tabIndex={-1}>
          <Image
            src={primary} alt={product.media[0]?.alt_text || product.name} fill priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-cover transition-all duration-[1200ms] ease-[var(--ease-fabric)] group-hover:scale-[1.04]",
              secondary && "group-hover:opacity-0",
            )}
          />
          {secondary && (
            <Image
              src={secondary} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover opacity-0 transition-all duration-[1200ms] ease-[var(--ease-fabric)] group-hover:scale-[1.04] group-hover:opacity-100"
            />
          )}
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {!product.in_stock ? (
            <Badge tone="muted">Sold out</Badge>
          ) : (
            <>
              {product.discount_percent > 0 && <Badge tone="mocha">{product.discount_percent}% off</Badge>}
              {product.is_new && <Badge>New</Badge>}
              {product.is_bestseller && <Badge tone="gold">Bestseller</Badge>}
              {product.is_low_stock && <Badge>Few left</Badge>}
            </>
          )}
        </div>

        <WishlistButton product={product} className="absolute right-3 top-3" />

        {/* Quick actions: always visible on touch, revealed on hover with a pointer */}
        <div className="absolute inset-x-3 bottom-3 flex gap-2 transition-all duration-500 ease-[var(--ease-fabric)] md:translate-y-3 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
          <button
            type="button" onClick={quickAdd} disabled={!product.in_stock || pending}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-ivory/95 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-deep shadow-sm backdrop-blur transition hover:bg-mocha hover:text-ivory disabled:opacity-60"
          >
            <Plus size={15} aria-hidden />
            {product.in_stock ? (single ? "Add to bag" : "Choose options") : "Sold out"}
          </button>
          <button
            type="button" onClick={() => openQuickView(product)} aria-label={`Quick view ${product.name}`}
            className="hidden h-11 w-11 place-items-center rounded-full bg-ivory/95 text-deep shadow-sm backdrop-blur transition hover:bg-mocha hover:text-ivory md:grid"
          >
            <Eye size={17} strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1.5 px-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.66rem] uppercase tracking-[0.22em] text-mocha">{product.collection?.name}</span>
          <Swatches swatches={product.swatches} />
        </div>
        <h3 className="text-[1.3rem] leading-tight">
          <Link href={href} className="transition-colors hover:text-mocha">{product.name}</Link>
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Price price={product.price} compareAt={product.compare_at_price} />
          {product.rating_count > 0 && <Stars value={product.rating_average} count={product.rating_count} size={12} />}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton aspect-[3/4] !rounded-[var(--radius-card)]" />
      <div className="skeleton mt-4 h-3 w-1/3" />
      <div className="skeleton mt-2 h-5 w-3/4" />
      <div className="skeleton mt-2 h-4 w-1/4" />
    </div>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Product[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < priorityCount} />)}
    </div>
  );
}
