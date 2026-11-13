"use client";

import { useQuery } from "@tanstack/react-query";
import { Heart, MapPin, Package, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { AccountShell, StatusPill } from "@/components/account/parts";
import { api } from "@/lib/api/client";
import { useUser } from "@/lib/hooks";
import type { OrderSummary, Paginated } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";
import { useWishlist } from "@/stores/ui";

export default function AccountPage() {
  const { user } = useUser();
  const wishlist = useWishlist((s) => s.ids.length);
  const { data } = useQuery({ queryKey: ["orders"], queryFn: () => api<Paginated<OrderSummary>>("/orders/"), enabled: Boolean(user) });
  const latest = data?.results[0];
  const tiles = [
    { href: "/account/orders", icon: Package, label: "Orders", text: data ? `${data.count} placed` : "View and track" },
    { href: "/account/returns", icon: RefreshCcw, label: "Returns", text: "Return or exchange" },
    { href: "/account/addresses", icon: MapPin, label: "Addresses", text: "For faster checkout" },
    { href: "/wishlist", icon: Heart, label: "Wishlist", text: `${wishlist} saved` },
  ];
  return (
    <AccountShell title={`Salaam, ${user?.first_name || "lovely"}`}>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map(({ href, icon: Icon, label, text }) => (
          <li key={href}>
            <Link href={href} className="block rounded-[20px] border hairline bg-white/60 p-5 transition hover:-translate-y-1 hover:shadow-soft">
              <Icon size={22} strokeWidth={1.3} className="text-mocha" aria-hidden />
              <p className="mt-3 font-serif text-2xl">{label}</p>
              <p className="text-sm text-mocha">{text}</p>
            </Link>
          </li>
        ))}
      </ul>
      {latest && (
        <section className="mt-10" aria-label="Latest order">
          <h2 className="mb-4 text-2xl">Your latest order</h2>
          <Link href={`/account/orders/${latest.number}`} className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-cream/80 p-5 transition hover:bg-cream">
            <div>
              <p className="font-bold text-deep">{latest.number}</p>
              <p className="text-sm text-mocha">{formatDate(latest.created_at)} · {latest.item_count} item{latest.item_count === 1 ? "" : "s"} · {formatINR(latest.grand_total)}</p>
            </div>
            <StatusPill status={latest.status} label={latest.status_label} />
          </Link>
        </section>
      )}
    </AccountShell>
  );
}
