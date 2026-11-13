"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { OrderDetail } from "@/components/account/OrderDetail";
import { AccountShell } from "@/components/account/parts";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { api, errorMessage } from "@/lib/api/client";
import type { Order } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useUI } from "@/stores/ui";

export default function OrderPage() {
  const { number } = useParams<{ number: string }>();
  const client = useQueryClient();
  const { data: order, isLoading, isError } = useQuery({ queryKey: ["order", number], queryFn: () => api<Order>(`/orders/${number}/`), retry: false });

  const cancel = async () => {
    if (!window.confirm("Cancel this order?")) return;
    try {
      client.setQueryData(["order", number], await api<Order>(`/orders/${number}/cancel/`, { method: "POST" }));
      client.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Your order has been cancelled.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const reorder = async () => {
    try {
      const result = await api<{ added: number; skipped: number }>(`/orders/${number}/reorder/`, { method: "POST" });
      await client.invalidateQueries({ queryKey: ["cart"] });
      toast.success(result.skipped ? `${result.added} added. ${result.skipped} no longer available.` : "Added to your bag");
      useUI.getState().openCart();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <AccountShell title={`Order ${number}`} eyebrow={order ? `Placed ${formatDate(order.created_at)}` : "Order"}>
      {isLoading ? (
        <div className="skeleton h-96" />
      ) : isError || !order ? (
        <EmptyState title="Order not found" action={<Button href="/account/orders">Back to orders</Button>} />
      ) : (
        <OrderDetail
          order={order}
          actions={
            <>
              <Button full onClick={reorder}>Order again</Button>
              {order.is_returnable && <Button variant="outline" full href={`/account/returns?order=${order.number}`}>Return or exchange</Button>}
              {order.is_cancellable && <Button variant="outline" full onClick={cancel}>Cancel order</Button>}
              <Link href="/contact" className="text-center text-sm text-mocha underline underline-offset-4">Need help with this order?</Link>
            </>
          }
        />
      )}
    </AccountShell>
  );
}
