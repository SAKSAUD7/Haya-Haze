"use client";

import { Gift, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { CartLineItem, CodeForm, FreeShippingBar, TotalsRows } from "@/components/cart/CartParts";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { useCart, useCartActions } from "@/lib/hooks";
import { formatINR } from "@/lib/utils";

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const { patch } = useCartActions();
  const [giftNote, setGiftNote] = useState("");
  const [orderNote, setOrderNote] = useState("");

  useEffect(() => {
    if (cart) {
      setGiftNote(cart.gift_note);
      setOrderNote(cart.order_note);
    }
    // Only when the cart first arrives; typing must not be overwritten by refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(cart)]);

  useEffect(() => {
    document.title = "Your Bag | Haya & Haze";
  }, []);

  if (isLoading || !cart) {
    return (
      <div className="container-page py-12">
        <div className="skeleton mb-8 h-12 w-56" />
        <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32" />)}</div>
          <div className="skeleton h-80" />
        </div>
      </div>
    );
  }

  if (cart.items.length === 0 && cart.saved.length === 0) {
    return (
      <div className="container-page">
        <EmptyState
          title="Your bag is empty" text="When something catches your eye, it will wait for you here."
          action={<Button href="/collections/all">Start exploring</Button>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-10 md:py-14">
      <p className="eyebrow mb-3">Your bag</p>
      <h1 className="mb-8 text-5xl md:text-6xl">{cart.item_count} {cart.item_count === 1 ? "piece" : "pieces"}, chosen well</h1>

      <div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div>
          <FreeShippingBar cart={cart} />
          {cart.issues.map((issue) => (
            <p key={issue} role="alert" className="mt-3 rounded-xl bg-blush/60 px-4 py-3 text-sm text-deep">{issue}</p>
          ))}
          <ul className="divide-y divide-sand/70">
            {cart.items.map((line) => <CartLineItem key={line.id} line={line} />)}
          </ul>

          {cart.saved.length > 0 && (
            <section className="mt-8" aria-label="Saved for later">
              <h2 className="text-2xl">Saved for later</h2>
              <ul className="divide-y divide-sand/70">
                {cart.saved.map((line) => <CartLineItem key={line.id} line={line} saved />)}
              </ul>
            </section>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border hairline p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox" className="mt-1 h-4 w-4 accent-[#7B4F3A]" checked={cart.gift_wrap}
                  onChange={(e) => patch({ gift_wrap: e.target.checked }).catch(() => undefined)}
                />
                <span>
                  <span className="flex items-center gap-2 font-bold text-deep"><Gift size={16} aria-hidden /> Gift wrap this order (+{formatINR(cart.gift_wrap_price)})</span>
                  <span className="text-sm text-mocha">Tissue, ribbon and a handwritten card.</span>
                </span>
              </label>
              {cart.gift_wrap && (
                <>
                  <label htmlFor="gift-note" className="mt-4 block text-sm text-mocha">Message for the card</label>
                  <textarea
                    id="gift-note" rows={2} maxLength={300} value={giftNote} onChange={(e) => setGiftNote(e.target.value)}
                    onBlur={() => giftNote !== cart.gift_note && patch({ gift_note: giftNote }).catch(() => undefined)}
                    className="field mt-1.5 resize-none" placeholder="Eid Mubarak, with love…"
                  />
                </>
              )}
            </div>
            <div className="rounded-2xl border hairline p-5">
              <label htmlFor="order-note" className="font-bold text-deep">Anything we should know?</label>
              <p className="text-sm text-mocha">Delivery instructions or a note for our team.</p>
              <textarea
                id="order-note" rows={2} maxLength={500} value={orderNote} onChange={(e) => setOrderNote(e.target.value)}
                onBlur={() => orderNote !== cart.order_note && patch({ order_note: orderNote }).catch(() => undefined)}
                className="field mt-3 resize-none"
              />
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Order summary">
          <div className="rounded-[22px] bg-cream/80 p-6">
            <h2 className="mb-5 text-3xl">Summary</h2>
            <div className="mb-5 space-y-3">
              <CodeForm kind="coupon" cart={cart} />
              <CodeForm kind="gift-card" cart={cart} />
              {cart.coupon_message && <p className="text-sm text-danger">{cart.coupon_message}</p>}
            </div>
            <TotalsRows cart={cart} />
            <Button href="/checkout" full size="lg" className="mt-6" disabled={cart.items.length === 0}>
              <Lock size={15} aria-hidden /> Checkout securely
            </Button>
            <p className="mt-3 text-center text-xs text-mocha">UPI · Cards · Netbanking · Cash on Delivery</p>
          </div>
        </aside>
      </div>

      {cart.upsell.length > 0 && (
        <section className="mt-20" aria-label="Complete the look">
          <p className="eyebrow mb-3">Pairs beautifully</p>
          <h2 className="mb-8 text-3xl md:text-4xl">Complete the look</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {cart.upsell.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
