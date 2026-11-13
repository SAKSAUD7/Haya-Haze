"use client";

import { Gift, Minus, Plus, Tag, Truck, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api/client";
import { useCartActions } from "@/lib/hooks";
import type { Cart, CartLine } from "@/lib/types";
import { cn, formatINR, media } from "@/lib/utils";

export function FreeShippingBar({ cart, className }: { cart: Cart; className?: string }) {
  const threshold = Number(cart.free_shipping_threshold);
  const remaining = Number(cart.free_shipping_remaining);
  if (!threshold || cart.item_count === 0) return null;
  const progress = Math.min(100, Math.max(4, ((threshold - remaining) / threshold) * 100));
  const unlocked = remaining <= 0 || cart.shipping_free;
  return (
    <div className={cn("rounded-2xl bg-cream px-4 py-3.5", className)}>
      <p className="flex items-center gap-2 text-sm text-deep">
        <Truck size={16} strokeWidth={1.5} className="text-mocha" aria-hidden />
        {unlocked ? (
          <span>You have unlocked <b>free shipping</b>.</span>
        ) : (
          <span>Add <b>{formatINR(remaining)}</b> more for free shipping.</span>
        )}
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar"
        aria-valuenow={Math.round(unlocked ? 100 : progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to free shipping"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-camel to-gold transition-[width] duration-1000 ease-[var(--ease-fabric)]"
          style={{ width: `${unlocked ? 100 : progress}%` }}
        />
      </div>
    </div>
  );
}

export function CartLineItem({ line, onNavigate, saved = false }: { line: CartLine; onNavigate?: () => void; saved?: boolean }) {
  const { update, remove } = useCartActions();
  const href = `/products/${line.slug}`;
  return (
    <li className="flex gap-4 py-5">
      <Link href={href} onClick={onNavigate} className="relative h-28 w-[84px] shrink-0 overflow-hidden rounded-xl bg-ivory-cream">
        <Image src={media(line.image)} alt={line.name} fill sizes="84px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={href} onClick={onNavigate} className="font-serif text-xl leading-tight text-deep hover:text-mocha">
              {line.name}
            </Link>
            {line.variant_label && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-mocha">
                {line.color_hex && <span className="h-3 w-3 rounded-full border border-deep/15" style={{ background: line.color_hex }} />}
                {line.variant_label}
              </p>
            )}
          </div>
          <button
            type="button" onClick={() => remove.mutate(line.id)} aria-label={`Remove ${line.name}`}
            className="-mr-1.5 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-mocha transition hover:bg-cream hover:text-deep"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {saved ? (
            <button
              type="button" onClick={() => update.mutate({ id: line.id, saved_for_later: false })}
              className="text-xs font-bold uppercase tracking-[0.14em] text-mocha underline underline-offset-4 hover:text-deep"
            >
              Move to bag
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 items-center rounded-full border border-sand bg-white">
                <button
                  type="button" aria-label="Decrease quantity" className="grid h-9 w-9 place-items-center text-deep"
                  onClick={() => update.mutate({ id: line.id, quantity: line.quantity - 1 })}
                >
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center text-sm font-bold" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
                <button
                  type="button" aria-label="Increase quantity" disabled={line.quantity >= line.max_quantity}
                  className="grid h-9 w-9 place-items-center text-deep disabled:opacity-30"
                  onClick={() => update.mutate({ id: line.id, quantity: line.quantity + 1 })}
                >
                  <Plus size={13} />
                </button>
              </div>
              <button
                type="button" onClick={() => update.mutate({ id: line.id, saved_for_later: true })}
                className="hidden text-xs text-mocha underline underline-offset-4 hover:text-deep sm:block"
              >
                Save for later
              </button>
            </div>
          )}
          <div className="text-right">
            <p className="font-bold text-deep">{formatINR(line.line_total)}</p>
            {line.compare_at_price && Number(line.compare_at_price) > Number(line.unit_price) && (
              <p className="text-xs text-mocha/70 line-through">{formatINR(Number(line.compare_at_price) * line.quantity)}</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function CodeForm({ kind, cart }: { kind: "coupon" | "gift-card"; cart: Cart }) {
  const actions = useCartActions();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const isCoupon = kind === "coupon";
  const applied = isCoupon ? cart.coupon_code : cart.gift_card_code;
  const Icon = isCoupon ? Tag : Gift;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await (isCoupon ? actions.applyCoupon(code) : actions.applyGiftCard(code));
      toast.success(isCoupon ? "Code applied" : "Gift card applied");
      setCode("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-camel bg-cream/60 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-deep">
          <Icon size={15} className="text-mocha" aria-hidden />
          <b>{applied}</b> applied
        </span>
        <button
          type="button" className="text-xs text-mocha underline underline-offset-4 hover:text-deep"
          onClick={() => (isCoupon ? actions.removeCoupon() : actions.removeGiftCard()).catch(() => undefined)}
        >
          Remove
        </button>
      </div>
    );
  }
  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-mocha underline underline-offset-4 hover:text-deep"
      >
        <Icon size={15} aria-hidden />
        {isCoupon ? "Have a discount code?" : "Have a gift card?"}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor={`${kind}-code`}>{isCoupon ? "Discount code" : "Gift card code"}</label>
      <input
        id={`${kind}-code`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus
        placeholder={isCoupon ? "Discount code" : "Gift card code"} className="field !py-2.5 uppercase" autoComplete="off"
      />
      <button
        type="submit" disabled={busy || !code.trim()}
        className="rounded-xl bg-deep px-5 text-xs font-bold uppercase tracking-[0.14em] text-ivory transition hover:bg-mocha disabled:opacity-50"
      >
        {busy ? "…" : "Apply"}
      </button>
    </form>
  );
}

export function TotalsRows({ cart, showTotal = true }: { cart: Cart; showTotal?: boolean }) {
  const row = (label: React.ReactNode, value: React.ReactNode, strong = false) => (
    <div className={cn("flex items-baseline justify-between gap-4", strong ? "text-lg font-bold text-deep" : "text-sm text-mocha")}>
      <dt>{label}</dt>
      <dd className={strong ? "" : "text-deep"}>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2.5">
      {row("Subtotal", formatINR(cart.subtotal))}
      {Number(cart.discount) > 0 && row(<>Discount {cart.coupon_code && <span className="text-xs">({cart.coupon_code})</span>}</>, <span className="text-success">−{formatINR(cart.discount)}</span>)}
      {row(
        cart.shipping_method === "express" ? "Express shipping" : "Shipping",
        cart.item_count === 0 ? "—" : cart.shipping_free ? <span className="text-success">Free</span> : formatINR(cart.shipping),
      )}
      {Number(cart.cod_fee) > 0 && row("Cash on Delivery fee", formatINR(cart.cod_fee))}
      {Number(cart.gift_wrap_fee) > 0 && row("Gift wrap", formatINR(cart.gift_wrap_fee))}
      {Number(cart.gift_card_amount) > 0 && row(`Gift card (${cart.gift_card_code})`, <span className="text-success">−{formatINR(cart.gift_card_amount)}</span>)}
      {showTotal && (
        <>
          <div className="border-t hairline pt-3">{row("Total", formatINR(cart.total), true)}</div>
          <p className="text-xs text-mocha">
            {cart.tax_included ? `Includes ${formatINR(cart.tax_total)} GST` : `Plus ${formatINR(cart.tax_total)} GST`}
          </p>
        </>
      )}
    </dl>
  );
}
