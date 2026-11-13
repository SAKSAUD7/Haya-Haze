"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account/parts";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import type { Address, Pincode } from "@/lib/types";

const FIELDS: [keyof Address, string, string, boolean][] = [
  ["full_name", "Full name", "name", true], ["phone", "Mobile number", "tel-national", true], ["pincode", "Pincode", "postal-code", true],
  ["line1", "House / flat number and street", "address-line1", true], ["line2", "Area / locality", "address-line2", false],
  ["landmark", "Landmark", "off", false], ["city", "City", "address-level2", true], ["state", "State", "address-level1", true],
];

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map(([key]) => [key, String(address?.[key] ?? "")])));
  const [isDefault, setDefault] = useState(address?.is_default ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const change = async (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key === "pincode" && /^[1-9]\d{5}$/.test(value)) {
      const pin = await api<Pincode>(`/shipping/pincode/${value}/`).catch(() => null);
      if (pin) setValues((v) => ({ ...v, city: pin.city || v.city, state: pin.state || v.state }));
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...values, is_default: isDefault };
      await api(address ? `/account/addresses/${address.id}/` : "/account/addresses/", { method: address ? "PATCH" : "POST", body });
      toast.success("Address saved");
      onDone();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length) setErrors(error.fields);
      else toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 overflow-y-auto px-6 pb-7 sm:grid-cols-2">
      {FIELDS.map(([key, label, autoComplete, required]) => (
        <label key={key} className={`block text-sm text-mocha ${key === "full_name" || key === "line1" ? "sm:col-span-2" : ""}`}>
          {label}{!required && <span className="text-xs"> (optional)</span>}
          <input
            value={values[key]} onChange={(e) => change(key, e.target.value)} required={required} autoComplete={autoComplete}
            className="field mt-1.5" aria-invalid={Boolean(errors[key])} inputMode={key === "pincode" || key === "phone" ? "numeric" : undefined}
          />
          {errors[key] && <span className="mt-1 block text-xs text-danger" role="alert">{errors[key]}</span>}
        </label>
      ))}
      <label className="flex items-center gap-2.5 text-sm text-mocha sm:col-span-2">
        <input type="checkbox" checked={isDefault} onChange={(e) => setDefault(e.target.checked)} className="h-4 w-4 accent-[#7B4F3A]" /> Use as my default address
      </label>
      <Button type="submit" loading={busy} className="sm:col-span-2">Save address</Button>
    </form>
  );
}

export default function AddressesPage() {
  const client = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/account/addresses/") });
  const [editing, setEditing] = useState<Address | null | "new">(null);
  const refresh = () => client.invalidateQueries({ queryKey: ["addresses"] });

  const remove = async (address: Address) => {
    if (!window.confirm("Remove this address?")) return;
    await api(`/account/addresses/${address.id}/`, { method: "DELETE" }).catch((e) => toast.error(errorMessage(e)));
    refresh();
  };

  return (
    <AccountShell title="Your addresses">
      {isLoading ? <div className="skeleton h-40" /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data?.map((address) => (
            <li key={address.id} className="rounded-[20px] border hairline bg-white/60 p-5 text-sm">
              <p className="flex items-center gap-2 font-bold text-deep">
                {address.full_name}
                {address.is_default && <span className="rounded-full bg-light-gold/70 px-2.5 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-espresso">Default</span>}
              </p>
              <p className="mt-1 text-mocha">
                {address.line1}{address.line2 && `, ${address.line2}`}<br />
                {address.city}, {address.state} {address.pincode}<br />{address.phone}
              </p>
              <div className="mt-4 flex gap-4">
                <button type="button" onClick={() => setEditing(address)} className="flex items-center gap-1.5 text-mocha hover:text-deep"><Pencil size={14} aria-hidden /> Edit</button>
                <button type="button" onClick={() => remove(address)} className="flex items-center gap-1.5 text-mocha hover:text-danger"><Trash2 size={14} aria-hidden /> Remove</button>
              </div>
            </li>
          ))}
          <li>
            <button
              type="button" onClick={() => setEditing("new")}
              className="flex h-full min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-camel text-mocha transition hover:bg-cream"
            >
              <Plus size={22} strokeWidth={1.3} aria-hidden /> Add a new address
            </button>
          </li>
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} side="center" title={editing === "new" ? "New address" : "Edit address"} className="!max-w-[600px]">
        {editing !== null && (
          <AddressForm
            address={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </Sheet>
    </AccountShell>
  );
}
