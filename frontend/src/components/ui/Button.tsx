"use client";

import Link from "next/link";
import { useRef, type ComponentProps, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const VARIANTS = {
  // Warm Mocha: the main call to action
  mocha: "bg-mocha text-ivory hover:bg-deep shadow-soft",
  // Warm Camel carries Deep Mocha text (white on camel fails contrast)
  camel: "bg-camel text-deep hover:bg-latte",
  outline: "border border-mocha/50 text-deep hover:border-mocha hover:bg-cream",
  light: "bg-ivory text-deep hover:bg-cream",
  ghost: "text-deep hover:bg-cream",
  gold: "bg-gold text-espresso hover:bg-light-gold",
} as const;

const SIZES = {
  sm: "h-10 px-5 text-[0.78rem]",
  md: "h-12 px-7 text-[0.82rem]",
  lg: "h-14 px-9 text-[0.86rem]",
} as const;

type Props = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Button leans gently toward the cursor (pointer devices only). */
  magnetic?: boolean;
  loading?: boolean;
  full?: boolean;
  href?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "children">;

export function Button({
  variant = "mocha", size = "md", magnetic = false, loading = false, full = false, href, className, children,
  disabled, ...rest
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  const onMove = (event: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!magnetic || !el || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * 0.22;
    const y = (event.clientY - rect.top - rect.height / 2) * 0.3;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  const classes = cn(
    "relative inline-flex items-center justify-center gap-2 rounded-full font-sans font-bold uppercase tracking-[0.16em]",
    "transition-[background-color,border-color,color,transform,box-shadow] duration-500 ease-[var(--ease-fabric)]",
    "disabled:opacity-50 select-none whitespace-nowrap",
    VARIANTS[variant], SIZES[size], full && "w-full", className,
  );
  const content = (
    <>
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-80")}>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
        onClick={rest.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...rest}
    >
      {content}
    </button>
  );
}
