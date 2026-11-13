"use client";

import { useMemo, useState } from "react";

import type { Product, Variant } from "@/lib/types";
import { cn, firstAvailable, uniq } from "@/lib/utils";

/** Colour and size selection for a product, resolving to one purchasable variant. */
export function useVariantSelection(product: Pick<Product, "variants">, initialColor?: string) {
  const variants = product.variants;
  const start = useMemo(
    () => firstAvailable(initialColor ? variants.filter((v) => v.color_name === initialColor) : variants) ?? variants[0],
    [variants, initialColor],
  );
  const [color, setColor] = useState(start?.color_name ?? "");
  const [size, setSize] = useState(start?.size ?? "");

  const colors = useMemo(
    () => uniq(variants.map((v) => v.color_name).filter(Boolean)).map((name) => ({
      name,
      hex: variants.find((v) => v.color_name === name)?.color_hex || "#C8A882",
      available: variants.some((v) => v.color_name === name && v.available > 0),
    })),
    [variants],
  );
  const sizes = useMemo(
    () => uniq(variants.map((v) => v.size).filter(Boolean)).map((name) => {
      const match = variants.find((v) => v.size === name && (!color || v.color_name === color));
      return { name, length: match?.length ?? "", available: Boolean(match && match.available > 0) };
    }),
    [variants, color],
  );

  const variant: Variant | undefined =
    variants.find((v) => (!color || v.color_name === color) && (!size || v.size === size)) ??
    variants.find((v) => !color || v.color_name === color);

  const chooseColor = (name: string) => {
    setColor(name);
    // Keep the chosen size if that colour has it in stock; otherwise move to one that is.
    const same = variants.find((v) => v.color_name === name && v.size === size && v.available > 0);
    if (!same) {
      const next = firstAvailable(variants.filter((v) => v.color_name === name));
      if (next) setSize(next.size);
    }
  };

  return { color, size, colors, sizes, variant, chooseColor, chooseSize: setSize };
}

export function VariantPicker({
  selection, onSizeGuide, compact = false,
}: { selection: ReturnType<typeof useVariantSelection>; onSizeGuide?: () => void; compact?: boolean }) {
  const { color, size, colors, sizes, chooseColor, chooseSize } = selection;
  const showSizes = sizes.length > 1 || (sizes.length === 1 && sizes[0].name !== "Free Size");
  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      {colors.length > 0 && (
        <fieldset>
          <legend className="mb-2.5 text-sm text-mocha">
            Colour: <span className="font-bold text-deep">{color}</span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => chooseColor(c.name)}
                aria-pressed={color === c.name}
                aria-label={`${c.name}${c.available ? "" : " (sold out)"}`}
                title={c.name}
                className={cn(
                  "relative h-9 w-9 rounded-full border transition-all duration-300",
                  color === c.name ? "border-mocha ring-2 ring-mocha ring-offset-2 ring-offset-ivory" : "border-sand hover:scale-110",
                )}
                style={{ background: c.hex }}
              >
                {!c.available && (
                  <span className="absolute inset-0 grid place-items-center" aria-hidden>
                    <span className="h-px w-[130%] rotate-45 bg-deep/60" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {showSizes && (
        <fieldset>
          <legend className="mb-2.5 flex w-full items-center justify-between text-sm text-mocha">
            <span>
              Size: <span className="font-bold text-deep">{size}</span>
              {sizes.find((s) => s.name === size)?.length && (
                <span> · length {sizes.find((s) => s.name === size)?.length}&quot;</span>
              )}
            </span>
            {onSizeGuide && (
              <button type="button" onClick={onSizeGuide} className="text-xs underline underline-offset-4 hover:text-deep">
                Size guide
              </button>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s.name}
                type="button"
                disabled={!s.available}
                onClick={() => chooseSize(s.name)}
                aria-pressed={size === s.name}
                className={cn(
                  "min-w-12 rounded-full border px-4 py-2 text-sm transition-colors duration-300",
                  size === s.name ? "border-mocha bg-mocha text-ivory" : "border-sand bg-white text-deep hover:border-mocha",
                  !s.available && "border-dashed text-mocha/50 line-through hover:border-sand",
                )}
              >
                {s.name}
                {s.length && !compact ? <span className="ml-1 text-xs opacity-75">{s.length}&quot;</span> : null}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function Swatches({ swatches, max = 5, size = 14 }: { swatches: { name: string; hex: string }[]; max?: number; size?: number }) {
  if (swatches.length < 2) return null;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${swatches.length} colours`}>
      {swatches.slice(0, max).map((s) => (
        <span
          key={s.name} title={s.name} className="rounded-full border border-deep/15"
          style={{ background: s.hex, width: size, height: size }}
        />
      ))}
      {swatches.length > max && <span className="text-xs text-mocha">+{swatches.length - max}</span>}
    </span>
  );
}
