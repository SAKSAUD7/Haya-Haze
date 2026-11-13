"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useLogout, useUser } from "@/lib/hooks";
import type { Order } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

export function TotalsRowsStatic({ order }: { order: Order }) {
  const row = (label: string, value: ReactNode, strong = false) => (
    <div className={cn("flex items-baseline justify-between gap-4", strong ? "text-lg font-bold text-deep" : "text-sm text-mocha")}>
      <dt>{label}</dt>
      <dd className={strong ? "" : "text-deep"}>{value}</dd>
    </div>
  );
  return (
    <dl className="space-y-2.5">
      {row("Subtotal", formatINR(order.subtotal))}
      {Number(order.discount_total) > 0 && row(`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`, `−${formatINR(order.discount_total)}`)}
      {row("Shipping", Number(order.shipping_total) > 0 ? formatINR(order.shipping_total) : "Free")}
      {Number(order.cod_fee) > 0 && row("Cash on Delivery fee", formatINR(order.cod_fee))}
      {Number(order.gift_wrap_fee) > 0 && row("Gift wrap", formatINR(order.gift_wrap_fee))}
      {Number(order.gift_card_amount) > 0 && row("Gift card", `−${formatINR(order.gift_card_amount)}`)}
      <div className="border-t hairline pt-3">
        {row(order.payment_method === "cod" && order.payment_status !== "paid" ? "To pay on delivery" : "Total", formatINR(order.total), true)}
      </div>
      <p className="text-xs text-mocha">{order.tax_included ? "Includes" : "Plus"} {formatINR(order.tax_total)} GST</p>
      {Number(order.refunded_total) > 0 && row("Refunded", formatINR(order.refunded_total))}
    </dl>
  );
}

const NAV = [
  ["Overview", "/account"], ["Orders", "/account/orders"], ["Returns", "/account/returns"], ["Addresses", "/account/addresses"],
  ["Wishlist", "/wishlist"], ["Profile", "/account/profile"],
] as const;

/** Frame for signed-in account pages: redirects guests to sign in, shows the section nav. */
export function AccountShell({ title, eyebrow = "My account", children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();

  useEffect(() => {
    if (!loading && !user) router.replace(`/account/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  useEffect(() => {
    document.title = `${title} | Haya & Haze`;
  }, [title]);

  if (loading || !user) {
    return <div className="container-page py-12"><div className="skeleton h-96" /></div>;
  }
  return (
    <div className="container-page py-10 md:py-14">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="mb-8 text-4xl md:text-5xl">{title}</h1>
      <div className="grid gap-10 lg:grid-cols-[210px_1fr] lg:gap-14">
        <nav aria-label="Account" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(([label, href]) => {
              const active = href === "/account" ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href} aria-current={active ? "page" : undefined}
                    className={cn("block whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition-colors", active ? "bg-mocha text-ivory" : "text-deep hover:bg-cream")}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button" className="block whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-mocha hover:bg-cream"
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                Sign out
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === "delivered" || status === "refunded" || status === "exchanged" ? "bg-success/12 text-success"
      : status === "cancelled" || status === "rejected" ? "bg-danger/10 text-danger"
        : "bg-light-gold/60 text-espresso";
  return <span className={cn("rounded-full px-3 py-1 text-xs font-bold", tone)}>{label}</span>;
}
