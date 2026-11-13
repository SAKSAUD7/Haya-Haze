"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { OrderDetail } from "@/components/account/OrderDetail";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { api } from "@/lib/api/client";
import { useUser } from "@/lib/hooks";
import type { Order } from "@/lib/types";

function Confirmation() {
  const { number } = useParams<{ number: string }>();
  const search = useSearchParams();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const tracked = useRef(false);
  const stripeSession = search.get("session_id");

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(`hh-order-${number}`) ?? "");
    } catch {
      setToken("");
    }
    document.title = "Order confirmed | Haya & Haze";
  }, [number]);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", number, token, stripeSession],
    queryFn: async () => {
      // Returning from Stripe: confirm the session first (the webhook does the same, idempotently).
      if (stripeSession) await api("/payments/stripe/verify/", { method: "POST", body: { session_id: stripeSession } }).catch(() => undefined);
      return api<Order>(`/orders/${number}/`, { params: { token: token || undefined } });
    },
    enabled: token !== null,
    retry: 1,
  });

  useEffect(() => {
    if (order && order.status !== "pending" && !tracked.current) {
      tracked.current = true;
      const key = `hh-purchase-${order.number}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        track("purchase", { order });
      }
    }
  }, [order]);

  if (isLoading || token === null) return <div className="container-page py-12"><div className="skeleton h-96" /></div>;
  if (isError || !order) {
    return (
      <div className="container-page">
        <EmptyState
          title="We could not open this order" text="Use your order number and email to look it up."
          action={<Button href="/track-order">Track an order</Button>}
        />
      </div>
    );
  }

  const pending = order.status === "pending";
  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <motion.svg
          width="76" height="76" viewBox="0 0 76 76" className="mx-auto mb-5" aria-hidden
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx="38" cy="38" r="36" fill="#F5EDE4" stroke="#C9A84C" strokeWidth="1" />
          <motion.path
            d="M24 39 34 49 53 28" fill="none" stroke="#7B4F3A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
          />
        </motion.svg>
        <p className="eyebrow mb-3">Order {order.number}</p>
        <h1 className="text-4xl md:text-6xl">{pending ? "Waiting for your payment" : `Thank you, ${order.ship_name.split(" ")[0]}.`}</h1>
        <p className="mt-4 text-mocha">
          {pending
            ? "We have reserved your pieces for a few minutes. Complete the payment to confirm your order."
            : order.payment_method === "cod"
              ? `Your order is confirmed. Please keep ₹${Number(order.total).toLocaleString("en-IN")} ready for the courier. A confirmation is on its way to ${order.email}.`
              : `Your order is confirmed and a receipt is on its way to ${order.email}. We will email you again the moment it ships.`}
        </p>
      </div>
      <OrderDetail
        order={order} token={token || undefined}
        actions={
          <>
            <Button href="/collections/all" full>Continue shopping</Button>
            {!user && <Button href="/account/register" variant="outline" full>Create an account to track orders</Button>}
          </>
        }
      />
    </div>
  );
}

export default function SuccessPage() {
  return <Suspense><Confirmation /></Suspense>;
}
