"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";

import { AccountShell, StatusPill } from "@/components/account/parts";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api/client";
import type { OrderSummary, Paginated } from "@/lib/types";
import { formatDate, formatINR, media } from "@/lib/utils";

export default function OrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => api<Paginated<OrderSummary>>("/orders/") });
  return (
    <AccountShell title="Your orders">
      {isLoading ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      ) : !data?.results.length ? (
        <EmptyState title="No orders yet" text="Your first order will appear here." action={<Button href="/collections/all">Start shopping</Button>} />
      ) : (
        <ul className="space-y-4">
          {data.results.map((order) => (
            <li key={order.number}>
              <Link href={`/account/orders/${order.number}`} className="flex flex-wrap items-center gap-4 rounded-[20px] border hairline bg-white/60 p-4 transition hover:shadow-soft md:p-5">
                <div className="flex -space-x-3">
                  {order.thumbnails.slice(0, 3).map((src, i) => (
                    <span key={i} className="relative h-16 w-12 overflow-hidden rounded-lg border-2 border-ivory bg-ivory-cream">
                      <Image src={media(src)} alt="" fill sizes="48px" className="object-cover" />
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-deep">{order.number}</p>
                  <p className="text-sm text-mocha">{formatDate(order.created_at)} · {order.item_count} item{order.item_count === 1 ? "" : "s"}</p>
                </div>
                <p className="font-bold">{formatINR(order.grand_total)}</p>
                <StatusPill status={order.status} label={order.status_label} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
