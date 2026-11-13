"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { OrderDetail } from "@/components/account/OrderDetail";
import { Button } from "@/components/ui/Button";
import { api, errorMessage } from "@/lib/api/client";
import type { Order, PlaceOrderResponse } from "@/lib/types";

export default function TrackOrderPage() {
  const [result, setResult] = useState<{ order: Order; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Track your order | Haya & Haze";
  }, []);

  const lookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const data = await api<PlaceOrderResponse>("/orders/track/", {
        method: "POST", body: { number: String(form.get("number")).trim(), email: String(form.get("email")).trim() },
      });
      setResult({ order: data.order, token: data.access_token });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!result || !window.confirm("Cancel this order?")) return;
    try {
      const order = await api<Order>(`/orders/${result.order.number}/cancel/`, { method: "POST", params: { token: result.token } });
      setResult({ ...result, order });
      toast.success("Your order has been cancelled.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow mb-3">Where is my order?</p>
        <h1 className="text-5xl md:text-6xl">Track your order</h1>
        <p className="mt-4 text-mocha">Enter the order number from your confirmation email and the email address you ordered with.</p>
        <form onSubmit={lookup} className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <label className="block text-sm text-mocha">Order number
            <input name="number" required placeholder="HH2511000000" className="field mt-1.5 uppercase" autoComplete="off" />
          </label>
          <label className="block text-sm text-mocha">Email
            <input name="email" type="email" required className="field mt-1.5" autoComplete="email" />
          </label>
          <Button type="submit" full loading={busy} className="sm:col-span-2">Find my order</Button>
        </form>
        {error && <p className="mt-4 text-danger" role="alert">{error}</p>}
      </div>

      {result && (
        <div className="mt-14">
          <h2 className="mb-6 text-3xl">Order {result.order.number}</h2>
          <OrderDetail
            order={result.order} token={result.token}
            actions={result.order.is_cancellable ? <Button variant="outline" full onClick={cancel}>Cancel order</Button> : undefined}
          />
        </div>
      )}
    </div>
  );
}
