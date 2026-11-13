"use client";

import { Check, Download, ExternalLink, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { TotalsRowsStatic } from "@/components/account/parts";
import type { Order } from "@/lib/types";
import { cn, formatDate, formatINR, media } from "@/lib/utils";

const STEPS = ["Placed", "Confirmed", "Packed", "Shipped", "Out for delivery", "Delivered"];

export function OrderTimeline({ order }: { order: Order }) {
  if (order.progress < 0) {
    return (
      <p className="rounded-2xl bg-blush/60 px-5 py-4 text-deep">
        This order is <b>{order.status_label.toLowerCase()}</b>.
        {order.payment_status === "refunded" && " Your refund has been issued."}
      </p>
    );
  }
  return (
    <ol className="flex items-start" aria-label="Order progress">
      {STEPS.map((step, i) => {
        const done = i <= order.progress;
        const current = i === order.progress;
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {i > 0 && <span className={cn("absolute right-1/2 top-[13px] h-0.5 w-full -translate-y-1/2", done ? "bg-mocha" : "bg-sand")} aria-hidden />}
            <span
              className={cn(
                "relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 text-ivory transition-colors",
                done ? "border-mocha bg-mocha" : "border-sand bg-ivory", current && "ring-4 ring-camel/40",
              )}
            >
              {done && <Check size={14} strokeWidth={2.5} aria-hidden />}
            </span>
            <span className={cn("mt-2 px-0.5 text-[0.68rem] leading-tight md:text-xs", done ? "font-bold text-deep" : "text-mocha")}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetail({ order, token, actions }: { order: Order; token?: string; actions?: React.ReactNode }) {
  const shipment = order.shipments[0];
  const invoice = `/api/v1/orders/${order.number}/invoice/${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  return (
    <div className="space-y-8">
      <div className="rounded-[22px] border hairline bg-white/60 p-5 md:p-7">
        <OrderTimeline order={order} />
        {shipment?.awb && (
          <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t hairline pt-4 text-sm text-deep">
            <span className="flex items-center gap-2"><Package size={16} strokeWidth={1.4} aria-hidden /> {shipment.courier || "Courier"} · {shipment.awb}</span>
            {shipment.tracking_url && (
              <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-mocha underline underline-offset-4">
                Track parcel <ExternalLink size={13} aria-hidden />
              </a>
            )}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-3 text-2xl">Items</h2>
          <ul className="divide-y divide-sand/70 border-y hairline">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <Link href={`/products/${item.product_slug}`} className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-xl bg-ivory-cream">
                  <Image src={media(item.image)} alt="" fill sizes="72px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.product_slug}`} className="font-serif text-xl leading-tight hover:text-mocha">{item.product_name}</Link>
                  <p className="text-sm text-mocha">{item.variant_label}{item.variant_label && " · "}Qty {item.quantity}</p>
                </div>
                <p className="font-bold">{formatINR(item.line_total)}</p>
              </li>
            ))}
          </ul>

          <h2 className="mb-3 mt-8 text-2xl">Updates</h2>
          <ol className="space-y-3">
            {[...order.events].reverse().map((event, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-camel" aria-hidden />
                <span>
                  <span className="text-deep">{event.note || event.status_label}</span>
                  <span className="block text-xs text-mocha">{formatDate(event.created_at, true)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[22px] bg-cream/80 p-6">
            <h2 className="mb-4 text-2xl">Summary</h2>
            <TotalsRowsStatic order={order} />
            <p className="mt-3 text-xs text-mocha">Paid with: {order.payment_method_label}</p>
          </div>
          <div className="rounded-[22px] border hairline p-6 text-sm">
            <h2 className="mb-2 text-2xl">Delivering to</h2>
            <p className="font-bold text-deep">{order.ship_name}</p>
            <p className="text-mocha">
              {order.ship_line1}{order.ship_line2 && `, ${order.ship_line2}`}<br />
              {order.ship_landmark && <>{order.ship_landmark}<br /></>}
              {order.ship_city}, {order.ship_state} {order.ship_pincode}<br />
              {order.phone}
            </p>
            {order.gift_wrap && <p className="mt-3 rounded-xl bg-blush/50 px-3 py-2 text-deep">Gift wrapped{order.gift_note && `: “${order.gift_note}”`}</p>}
          </div>
          <div className="flex flex-col gap-2.5">
            {order.progress >= 1 && (
              <a
                href={invoice} target="_blank" rel="noopener noreferrer"
                className="flex h-12 items-center justify-center gap-2 rounded-full border border-mocha/50 text-[0.78rem] font-bold uppercase tracking-[0.16em] text-deep transition hover:bg-cream"
              >
                <Download size={15} aria-hidden /> Invoice
              </a>
            )}
            {actions}
          </div>
        </aside>
      </div>
    </div>
  );
}
