import { ChevronRight, Star } from "lucide-react";
import Link from "next/link";

import { cn, formatINR } from "@/lib/utils";

export function Price({
  price, compareAt, size = "md", className,
}: { price: string | number; compareAt?: string | number | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const onSale = compareAt != null && Number(compareAt) > Number(price);
  const off = onSale ? Math.round((1 - Number(price) / Number(compareAt)) * 100) : 0;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-sans font-bold text-deep", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base")}>
        {formatINR(price)}
      </span>
      {onSale && (
        <>
          <span className={cn("text-mocha/70 line-through", size === "lg" ? "text-base" : "text-sm")}>
            <span className="sr-only">Was </span>
            {formatINR(compareAt)}
          </span>
          {size === "lg" && <span className="text-sm font-bold text-success">{off}% off</span>}
        </>
      )}
    </span>
  );
}

export function Stars({ value, count, size = 14, className }: { value: number | string; count?: number; size?: number; className?: string }) {
  const rating = Number(value);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      <span className="relative inline-flex" aria-hidden>
        <span className="flex text-sand">
          {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}
        </span>
        <span className="absolute inset-0 flex overflow-hidden text-gold" style={{ width: `${(rating / 5) * 100}%` }}>
          {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} className="shrink-0" />)}
        </span>
      </span>
      {count !== undefined && <span className="text-xs text-mocha">({count})</span>}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs tracking-wide text-mocha">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="hover:text-deep hover:underline underline-offset-4">{item.label}</Link>
            ) : (
              <span aria-current="page" className="text-deep">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A gently moving drape line used in place of straight rules between sections. */
export function WaveDivider({ color = "var(--color-gold)", className, flip = false }: { color?: string; className?: string; flip?: boolean }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden>
      <svg
        viewBox="0 0 2400 60" preserveAspectRatio="none"
        className={cn("h-8 w-[200%] animate-[marquee_26s_linear_infinite]", flip && "-scale-y-100")}
      >
        <path
          d="M0 30 C 150 6, 300 54, 450 30 S 750 6, 900 30 S 1050 54, 1200 30 C 1350 6, 1500 54, 1650 30 S 1950 6, 2100 30 S 2250 54, 2400 30"
          fill="none" stroke={color} strokeWidth="1" opacity="0.6" vectorEffect="non-scaling-stroke"
        />
        <path
          d="M0 36 C 200 18, 400 50, 600 34 S 1000 18, 1200 36 C 1400 18, 1600 50, 1800 34 S 2200 18, 2400 36"
          fill="none" stroke={color} strokeWidth="1" opacity="0.28" vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function Badge({ children, tone = "ivory" }: { children: React.ReactNode; tone?: "ivory" | "mocha" | "gold" | "muted" }) {
  const tones = {
    ivory: "bg-ivory/95 text-deep",
    mocha: "bg-mocha text-ivory",
    gold: "bg-light-gold text-espresso",
    muted: "bg-espresso/75 text-ivory",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] shadow-sm", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden className="mb-6 text-camel">
        <path d="M14 20c10-8 34-8 44 0-3 14 2 26-6 36-8 6-24 6-32 0-8-10-3-22-6-36Z" stroke="currentColor" strokeWidth="1.2" />
        <path d="M24 22c1 12-2 22 3 32M36 20c0 14 1 24 0 37M48 22c-1 12 2 22-3 32" stroke="currentColor" strokeWidth="1" opacity=".55" />
      </svg>
      <h2 className="text-3xl">{title}</h2>
      {text && <p className="mt-3 text-mocha">{text}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}
