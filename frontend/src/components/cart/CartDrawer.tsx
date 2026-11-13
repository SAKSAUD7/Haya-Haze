"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useCart } from "@/lib/hooks";
import { formatINR, media, productImage } from "@/lib/utils";
import { useUI } from "@/stores/ui";

import { CartLineItem, FreeShippingBar } from "./CartParts";

export function CartDrawer() {
  const open = useUI((s) => s.cartOpen);
  const close = useUI((s) => s.closeCart);
  const openQuickView = useUI((s) => s.openQuickView);
  const { data: cart, isLoading } = useCart();

  return (
    <Sheet open={open} onClose={close} title={`Your bag${cart?.item_count ? ` (${cart.item_count})` : ""}`}>
      {isLoading || !cart ? (
        <div className="space-y-4 px-6 py-4">
          {[0, 1].map((i) => <div key={i} className="skeleton h-28" />)}
        </div>
      ) : cart.items.length === 0 ? (
        <div className="px-6">
          <EmptyState
            title="Your bag is empty"
            text="When something catches your eye, it will wait for you here."
            action={<Button href="/collections/all" onClick={close}>Start exploring</Button>}
          />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-6">
            <FreeShippingBar cart={cart} />
            {cart.issues.map((issue) => (
              <p key={issue} role="alert" className="mt-3 rounded-xl bg-blush/60 px-4 py-2.5 text-sm text-deep">{issue}</p>
            ))}
            <ul className="divide-y divide-sand/70">
              {cart.items.map((line) => <CartLineItem key={line.id} line={line} onNavigate={close} />)}
            </ul>

            {cart.upsell.length > 0 && (
              <div className="mb-6 mt-2 rounded-2xl bg-cream/70 p-4">
                <p className="eyebrow mb-3">Complete the look</p>
                <ul className="space-y-3">
                  {cart.upsell.slice(0, 2).map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ivory">
                        <Image src={productImage(p)} alt="" fill sizes="48px" className="object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${p.slug}`} onClick={close} className="block truncate font-serif text-lg leading-tight hover:text-mocha">
                          {p.name}
                        </Link>
                        <p className="text-sm text-mocha">{formatINR(p.price)}</p>
                      </div>
                      <button
                        type="button" onClick={() => openQuickView(p)} aria-label={`Add ${p.name}`}
                        className="grid h-9 w-9 place-items-center rounded-full border border-camel text-deep transition hover:bg-camel"
                      >
                        <Plus size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t hairline bg-ivory px-6 pb-6 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-mocha">Subtotal</span>
              <span className="text-xl font-bold text-deep">{formatINR(Number(cart.subtotal) - Number(cart.discount))}</span>
            </div>
            <p className="mb-4 mt-1 text-xs text-mocha">Taxes included. Shipping and discounts are confirmed at checkout.</p>
            <Button href="/checkout" full size="lg" onClick={close}>
              <Lock size={15} aria-hidden /> Checkout securely
            </Button>
            <Link href="/cart" onClick={close} className="mt-3 block text-center text-sm text-mocha underline underline-offset-4 hover:text-deep">
              View bag, add a code or gift wrap
            </Link>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Product images that fly from where "Add to bag" was pressed to the cart icon. */
export function FlyToCart() {
  const flights = useUI((s) => s.flights);
  const endFlight = useUI((s) => s.endFlight);
  return (
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden>
      <AnimatePresence>
        {flights.map((flight) => <Flight key={flight.id} {...flight} onDone={() => endFlight(flight.id)} />)}
      </AnimatePresence>
    </div>
  );
}

function Flight({ src, from, onDone }: { src: string; from: { x: number; y: number; w: number; h: number }; onDone: () => void }) {
  const target = typeof document !== "undefined" ? document.getElementById("cart-icon")?.getBoundingClientRect() : undefined;
  const to = target ?? new DOMRect(window.innerWidth - 60, 24, 24, 24);
  // Start from a card-sized tile centred on the source element.
  const w = Math.min(from.w, 150);
  const h = w * 1.3;
  const startX = from.x + from.w / 2 - w / 2;
  const startY = from.y + from.h / 2 - h / 2;

  useEffect(() => {
    const timer = setTimeout(onDone, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="absolute overflow-hidden rounded-2xl shadow-lift"
      style={{ left: 0, top: 0, width: w, height: h }}
      initial={{ x: startX, y: startY, scale: 1, opacity: 0.95, rotate: 0, skewX: 0 }}
      animate={{
        x: to.left + to.width / 2 - w / 2,
        y: [startY, Math.min(startY, to.top) - 70, to.top + to.height / 2 - h / 2],
        scale: [1, 0.72, 0.1],
        opacity: [0.95, 0.95, 0.3],
        rotate: [0, -8, 6],
        // the cloth flutters as it travels
        skewX: [0, 7, -5, 0],
      }}
      transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media(src)} alt="" className="h-full w-full object-cover" />
    </motion.div>
  );
}
