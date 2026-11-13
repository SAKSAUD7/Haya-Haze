"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AccountShell, StatusPill } from "@/components/account/parts";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { api, errorMessage } from "@/lib/api/client";
import type { Order, ReturnRequest } from "@/lib/types";
import { formatDate, formatINR, media } from "@/lib/utils";

const REASONS = [
  ["size", "Size or length did not fit"], ["colour", "Colour looked different"], ["quality", "Quality not as expected"],
  ["damaged", "Arrived damaged"], ["wrong_item", "Wrong item received"], ["other", "Something else"],
];

function RequestForm({ number, onDone }: { number: string; onDone: () => void }) {
  const { data: order, isLoading } = useQuery({ queryKey: ["order", number], queryFn: () => api<Order>(`/orders/${number}/`), retry: false });
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items = Object.entries(chosen).filter(([, qty]) => qty > 0).map(([id, quantity]) => ({ order_item: Number(id), quantity }));
    if (!items.length) {
      toast.error("Choose at least one item.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("order_number", number);
    form.set("items", JSON.stringify(items));
    for (const file of form.getAll("photos")) if (file instanceof File && file.size === 0) form.delete("photos");
    setBusy(true);
    try {
      await api("/returns/", { method: "POST", body: form });
      toast.success("Request received. We will email you shortly.");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="skeleton h-64" />;
  if (!order) return <p className="text-danger">We could not find that order.</p>;
  if (!order.is_returnable) {
    return <p className="rounded-2xl bg-cream px-5 py-4 text-deep">Returns are open for 7 days after delivery, so this order can no longer be returned online. Please contact us if something is wrong.</p>;
  }
  return (
    <form onSubmit={submit} className="space-y-6 rounded-[22px] border hairline bg-white/60 p-5 md:p-7">
      <h2 className="text-2xl">Return or exchange · {order.number}</h2>
      <fieldset>
        <legend className="mb-3 text-sm text-mocha">Which items?</legend>
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-sand bg-white p-3">
                <input
                  type="checkbox" className="h-4 w-4 accent-[#7B4F3A]" checked={Boolean(chosen[item.id])}
                  onChange={(e) => setChosen({ ...chosen, [item.id]: e.target.checked ? item.quantity : 0 })}
                />
                <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ivory-cream">
                  <Image src={media(item.image)} alt="" fill sizes="48px" className="object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg leading-tight">{item.product_name}</span>
                  <span className="text-sm text-mocha">{item.variant_label} · Qty {item.quantity} · {formatINR(item.line_total)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-mocha">I would like
          <select name="kind" className="field mt-1.5" defaultValue="return">
            <option value="return">A refund</option>
            <option value="exchange">An exchange (size or colour)</option>
          </select>
        </label>
        <label className="block text-sm text-mocha">Reason
          <select name="reason" className="field mt-1.5" required defaultValue="">
            <option value="" disabled>Choose a reason</option>
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-sm text-mocha">Tell us more <span className="text-xs">(for exchanges, the size or colour you would like)</span>
        <textarea name="details" rows={3} maxLength={1000} className="field mt-1.5 resize-none" />
      </label>
      <label className="block text-sm text-mocha">Photos <span className="text-xs">(up to 4; needed for damaged or wrong items)</span>
        <input name="photos" type="file" accept="image/*" multiple className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-cream file:px-4 file:py-2 file:text-deep" />
      </label>
      <Button type="submit" loading={busy}>Send request</Button>
    </form>
  );
}

function Returns() {
  const search = useSearchParams();
  const client = useQueryClient();
  const [open, setOpen] = useState(search.get("order") ?? "");
  const { data, isLoading } = useQuery({ queryKey: ["returns"], queryFn: () => api<ReturnRequest[]>("/returns/") });

  return (
    <AccountShell title="Returns & exchanges">
      {open && (
        <div className="mb-10">
          <RequestForm
            number={open}
            onDone={() => {
              setOpen("");
              client.invalidateQueries({ queryKey: ["returns"] });
            }}
          />
        </div>
      )}
      {isLoading ? (
        <div className="skeleton h-40" />
      ) : !data?.length ? (
        !open && (
          <EmptyState
            title="No returns or exchanges" text="To start one, open a delivered order and choose Return or exchange. Returns are open for 7 days after delivery."
            action={<Button href="/account/orders">Go to my orders</Button>}
          />
        )
      ) : (
        <ul className="space-y-4">
          {data.map((req) => (
            <li key={req.id} className="rounded-[20px] border hairline bg-white/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-deep">{req.kind_label} · {req.order_number}</p>
                  <p className="text-sm text-mocha">{formatDate(req.created_at)} · {req.reason_label}</p>
                </div>
                <StatusPill status={req.status} label={req.status_label} />
              </div>
              <ul className="mt-3 text-sm text-mocha">
                {req.items.map((item) => <li key={item.order_item}>{item.product_name} {item.variant_label && `(${item.variant_label})`} × {item.quantity}</li>)}
              </ul>
              {req.kind === "return" && Number(req.refund_amount) > 0 && <p className="mt-2 text-sm text-deep">Refund amount: <b>{formatINR(req.refund_amount)}</b></p>}
              {req.admin_note && <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-deep"><b>Haya &amp; Haze:</b> {req.admin_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}

export default function ReturnsPage() {
  return <Suspense><Returns /></Suspense>;
}
