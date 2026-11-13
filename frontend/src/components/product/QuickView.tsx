"use client";

import { Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Price, Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useAddToCart, useIsMobile } from "@/lib/hooks";
import type { Product } from "@/lib/types";
import { productImage } from "@/lib/utils";
import { useUI } from "@/stores/ui";

import { WishlistButton } from "./ProductCard";
import { useVariantSelection, VariantPicker } from "./VariantPicker";

export function QuantityStepper({ value, onChange, max = 10 }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="inline-flex h-12 items-center rounded-full border border-sand bg-white">
      <button
        type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}
        className="grid h-12 w-11 place-items-center text-deep disabled:opacity-35"
      >
        <Minus size={15} />
      </button>
      <span className="w-7 text-center text-sm font-bold" aria-live="polite" aria-label={`Quantity ${value}`}>{value}</span>
      <button
        type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="grid h-12 w-11 place-items-center text-deep disabled:opacity-35"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function QuickViewBody({ product, initialColor, side }: { product: Product; initialColor?: string; side: boolean }) {
  const selection = useVariantSelection(product, initialColor);
  const { variant, color } = selection;
  const [quantity, setQuantity] = useState(1);
  const { addToCart, pending } = useAddToCart();
  const close = useUI((s) => s.closeQuickView);
  const router = useRouter();
  const imageRef = useRef<HTMLDivElement>(null);
  const image = productImage(product, color);
  const soldOut = !variant || variant.available <= 0;

  const buyNow = async () => {
    if (await addToCart(product, variant, { quantity, silent: true })) {
      close();
      router.push("/checkout");
    }
  };

  return (
    <div className={side ? "flex flex-col overflow-y-auto" : "grid overflow-y-auto md:grid-cols-2"}>
      <div ref={imageRef} className={side ? "relative mx-6 aspect-[4/5] overflow-hidden rounded-[18px] bg-ivory-cream" : "relative aspect-[4/5] bg-ivory-cream md:aspect-auto md:min-h-[540px]"}>
        <Image key={image} src={image} alt={`${product.name} in ${color}`} fill sizes="(max-width: 768px) 100vw, 470px" className="object-cover" />
        <WishlistButton product={product} className="absolute left-3 top-3" />
      </div>
      <div className="flex flex-col gap-5 p-6 md:p-8">
        <div>
          <p className="eyebrow mb-2">{product.collection?.name}</p>
          <h2 className="text-3xl md:text-4xl">{product.name}</h2>
          {product.subtitle && <p className="mt-2 text-mocha">{product.subtitle}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Price price={variant?.price ?? product.price} compareAt={variant?.compare_at_price ?? product.compare_at_price} size="lg" />
            {product.rating_count > 0 && <Stars value={product.rating_average} count={product.rating_count} />}
          </div>
          <p className="mt-1 text-xs text-mocha">Inclusive of all taxes · {product.fabric_label}, {product.fabric_feel}</p>
        </div>

        <VariantPicker selection={selection} compact />

        {variant?.is_low_stock && !soldOut && (
          <p className="text-sm font-bold text-dusty">Only {variant.available} left in this option</p>
        )}

        <div className="flex items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(1, variant?.available ?? 1)} />
          <Button
            full size="lg" loading={pending} disabled={soldOut}
            onClick={() => addToCart(product, variant, { quantity, from: imageRef.current, image })}
          >
            {soldOut ? "Sold out" : "Add to bag"}
          </Button>
        </div>
        {!soldOut && (
          <Button variant="camel" full onClick={buyNow} disabled={pending}>Buy it now</Button>
        )}
        <Link
          href={`/products/${product.slug}`} onClick={close}
          className="text-center text-sm text-mocha underline underline-offset-4 hover:text-deep"
        >
          View full details
        </Link>
      </div>
    </div>
  );
}

/** One quick view for the whole site: cards, the 3D hero and the 3D wardrobe all open this. */
export function QuickView() {
  const quickView = useUI((s) => s.quickView);
  const close = useUI((s) => s.closeQuickView);
  const mobile = useIsMobile();
  const docked = quickView?.mode === "side" && !mobile;
  return (
    <Sheet
      open={Boolean(quickView)} onClose={close} title={quickView?.product.name ?? "Quick view"} hideTitle
      side={mobile ? "bottom" : docked ? "right" : "center"}
      // Beside the wardrobe the scene itself dims, so the page overlay stays clear.
      dim={!docked}
      className={docked ? "!max-w-[420px] pt-14" : undefined}
    >
      {quickView && (
        <QuickViewBody
          key={quickView.product.id} product={quickView.product} initialColor={quickView.color}
          side={docked}
        />
      )}
    </Sheet>
  );
}
