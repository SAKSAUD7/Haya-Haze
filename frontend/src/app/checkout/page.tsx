"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CreditCard, Globe, Lock, ShieldCheck, Truck, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CodeForm, TotalsRows } from "@/components/cart/CartParts";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { track } from "@/lib/analytics";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { useCart, useSite, useUser } from "@/lib/hooks";
import type { Address, Cart, Order, PaymentMethod, PaymentSession, Pincode, PlaceOrderResponse } from "@/lib/types";
import { cn, formatINR, media } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  phone: z.string().regex(/^(\+?91)?[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  full_name: z.string().min(2, "Enter your full name"),
  line1: z.string().min(5, "Enter your house number and street"),
  line2: z.string().optional(),
  landmark: z.string().optional(),
  pincode: z.string().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  city: z.string().min(2, "Enter your city"),
  state: z.string().min(2, "Enter your state"),
  save_address: z.boolean().optional(),
  subscribe: z.boolean().optional(),
});
type Form = z.infer<typeof schema>;

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm text-mocha", className)}>
      {label}
      <span className="mt-1.5 block">{children}</span>
      {error && <span className="mt-1 block text-xs text-danger" role="alert">{error}</span>}
    </label>
  );
}

function Choice({
  checked, onSelect, icon, title, text, right, disabled, name,
}: { checked: boolean; onSelect: () => void; icon: React.ReactNode; title: string; text?: string; right?: React.ReactNode; disabled?: boolean; name: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-4 rounded-2xl border bg-white p-4 transition-colors duration-300",
        checked ? "border-mocha ring-1 ring-mocha" : "border-sand hover:border-camel", disabled && "cursor-not-allowed opacity-55",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} disabled={disabled} className="h-4 w-4 accent-[#7B4F3A]" />
      <span className="text-mocha">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-deep">{title}</span>
        {text && <span className="block text-sm text-mocha">{text}</span>}
      </span>
      {right && <span className="text-sm font-bold text-deep">{right}</span>}
    </label>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const client = useQueryClient();
  const site = useSite();
  const { user } = useUser();
  const { data: bag, isLoading } = useCart();
  const [shipping, setShipping] = useState<"standard" | "express">("standard");
  const [payment, setPayment] = useState<"razorpay" | "cod" | "stripe">("razorpay");
  const [pin, setPin] = useState<Pincode | null>(null);
  const [placing, setPlacing] = useState(false);
  const [sandbox, setSandbox] = useState<{ session: PaymentSession; order: Order; token: string } | null>(null);
  // One key per attempt: a double-click or a retry after a timeout can never create two orders.
  const idempotencyKey = useRef("");
  const tracked = useRef(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema), mode: "onBlur",
  });
  const pincode = watch("pincode");

  const { data: methods } = useQuery({ queryKey: ["payment-methods"], queryFn: () => api<PaymentMethod[]>("/payments/methods/"), staleTime: 300_000 });
  const { data: addresses } = useQuery({
    queryKey: ["addresses"], queryFn: () => api<Address[]>("/account/addresses/"), enabled: Boolean(user),
  });
  // The summary is priced by the server for the chosen shipping and payment methods.
  const { data: quote } = useQuery({
    queryKey: ["cart", "quote", shipping, payment],
    queryFn: () => api<Cart>("/cart/", { params: { shipping_method: shipping, payment_method: payment } }),
    enabled: Boolean(bag?.items.length),
    placeholderData: (previous) => previous,
  });
  const cart = quote ?? bag;

  useEffect(() => {
    document.title = "Checkout | Haya & Haze";
  }, []);
  useEffect(() => {
    if (user) {
      setValue("email", user.email);
      if (user.phone) setValue("phone", user.phone);
    }
  }, [user, setValue]);
  useEffect(() => {
    if (cart && cart.items.length && !tracked.current) {
      tracked.current = true;
      track("begin_checkout", { value: Number(cart.total), count: cart.item_count });
    }
  }, [cart]);

  const applyAddress = (a: Address) => {
    reset({
      ...watch(), full_name: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark,
      pincode: a.pincode, city: a.city, state: a.state,
    });
  };
  useEffect(() => {
    const preferred = addresses?.find((a) => a.is_default) ?? addresses?.[0];
    if (preferred && !watch("line1")) applyAddress(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses]);

  // Pincode → city and state, delivery estimate and COD availability.
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pincode ?? "")) {
      setPin(null);
      return;
    }
    let cancelled = false;
    api<Pincode>(`/shipping/pincode/${pincode}/`).then((data) => {
      if (cancelled) return;
      setPin(data);
      if (data.city) setValue("city", data.city, { shouldValidate: true });
      if (data.state) setValue("state", data.state, { shouldValidate: true });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pincode, setValue]);

  const codAllowed = Boolean(cart?.cod_available) && (pin ? pin.cod_available : true);
  useEffect(() => {
    if (payment === "cod" && !codAllowed) setPayment("razorpay");
  }, [codAllowed, payment]);

  const finish = (order: Order, token: string) => {
    try {
      sessionStorage.setItem(`hh-order-${order.number}`, token);
    } catch {
      /* ignore */
    }
    client.invalidateQueries({ queryKey: ["cart"] });
    router.push(`/checkout/success/${order.number}`);
  };

  const payWithRazorpay = async (session: PaymentSession, order: Order, token: string, form: Form) => {
    if (session.sandbox) {
      setSandbox({ session, order, token });
      return;
    }
    if (!(await loadRazorpay()) || !window.Razorpay) {
      toast.error("We could not load the payment window. Please check your connection and try again.");
      return;
    }
    const checkout = new window.Razorpay({
      key: session.key_id, order_id: session.provider_order_id, currency: session.currency, name: "Haya & Haze",
      description: `Order ${order.number}`, prefill: { name: form.full_name, email: form.email, contact: form.phone },
      theme: { color: "#7B4F3A" },
      handler: async (response: Record<string, string>) => {
        try {
          // The server verifies the signature; the browser's word alone is never trusted.
          const paid = await api<Order>("/payments/razorpay/verify/", { method: "POST", body: response });
          finish(paid, token);
        } catch (error) {
          toast.error(errorMessage(error));
        }
      },
      modal: { ondismiss: () => toast.message("Payment not completed. Your bag is saved; you can try again.") },
    });
    checkout.open();
  };

  const submit = async (form: Form) => {
    if (!cart?.items.length) return;
    if (pin && !pin.serviceable) {
      toast.error(pin.message);
      return;
    }
    idempotencyKey.current ||= crypto.randomUUID();
    setPlacing(true);
    try {
      const result = await api<PlaceOrderResponse>("/checkout/place/", {
        method: "POST",
        body: {
          idempotency_key: idempotencyKey.current, email: form.email, phone: form.phone,
          address: { full_name: form.full_name, line1: form.line1, line2: form.line2 ?? "", landmark: form.landmark ?? "", city: form.city, state: form.state, pincode: form.pincode },
          shipping_method: shipping, payment_method: payment, save_address: Boolean(form.save_address), subscribe: Boolean(form.subscribe),
        },
      });
      const session = result.payment as PaymentSession | null;
      if (!session) finish(result.order, result.access_token);
      else if (session.provider === "stripe" && session.redirect_url) {
        sessionStorage.setItem(`hh-order-${result.order.number}`, result.access_token);
        window.location.href = session.redirect_url;
      } else await payWithRazorpay(session, result.order, result.access_token, form);
    } catch (error) {
      // A rejected order (stock, coupon, pincode) needs a fresh key for the corrected attempt.
      if (error instanceof ApiError && error.status === 400) idempotencyKey.current = "";
      toast.error(errorMessage(error));
      client.invalidateQueries({ queryKey: ["cart"] });
    } finally {
      setPlacing(false);
    }
  };

  const sandboxPay = async (outcome: "success" | "failure") => {
    if (!sandbox) return;
    try {
      const paid = await api<Order>("/payments/sandbox/pay/", { method: "POST", body: { provider_order_id: sandbox.session.provider_order_id, outcome } });
      setSandbox(null);
      finish(paid, sandbox.token);
    } catch (error) {
      setSandbox(null);
      idempotencyKey.current = "";
      toast.error(errorMessage(error));
      client.invalidateQueries({ queryKey: ["cart"] });
    }
  };

  if (isLoading || !cart) {
    return <div className="container-page py-12"><div className="skeleton h-[520px]" /></div>;
  }
  if (cart.items.length === 0) {
    return (
      <div className="container-page">
        <EmptyState title="Nothing to check out yet" text="Add a piece you love and come back." action={<Button href="/collections/all">Browse the collection</Button>} />
      </div>
    );
  }

  const online = (code: string) => methods?.some((m) => m.code === code);
  const expressExtra = cart.shipping_free && shipping === "standard"
    ? Number(site?.express_shipping_rate ?? 149) - Number(site?.standard_shipping_rate ?? 79)
    : Number(site?.express_shipping_rate ?? 149);
  const input = (name: keyof Form, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input {...register(name)} aria-invalid={Boolean(errors[name])} className="field" {...props} />
  );

  return (
    <div className="container-page py-8 md:py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Secure checkout</p>
          <h1 className="text-4xl md:text-5xl">Almost yours</h1>
        </div>
        <Link href="/cart" className="text-sm text-mocha underline underline-offset-4 hover:text-deep">Edit bag</Link>
      </div>

      <form onSubmit={handleSubmit(submit)} noValidate className="grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
        <div className="space-y-10">
          <section aria-labelledby="co-contact">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="co-contact" className="text-2xl">1. Contact</h2>
              {!user && <Link href="/account/login?next=/checkout" className="text-sm text-mocha underline underline-offset-4">Have an account? Sign in</Link>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email?.message}>{input("email", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}</Field>
              <Field label="Mobile number" error={errors.phone?.message}>{input("phone", { type: "tel", inputMode: "numeric", autoComplete: "tel-national", placeholder: "10-digit mobile" })}</Field>
            </div>
            <label className="mt-3 flex items-center gap-2.5 text-sm text-mocha">
              <input type="checkbox" {...register("subscribe")} className="h-4 w-4 accent-[#7B4F3A]" /> Email me about new drops and offers
            </label>
          </section>

          <section aria-labelledby="co-address">
            <h2 id="co-address" className="mb-4 text-2xl">2. Delivery address</h2>
            {addresses && addresses.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button
                    key={a.id} type="button" onClick={() => applyAddress(a)}
                    className="rounded-full border border-sand bg-white px-4 py-2 text-sm text-deep transition hover:border-mocha"
                  >
                    {a.full_name}, {a.city} {a.pincode}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.full_name?.message} className="sm:col-span-2">{input("full_name", { autoComplete: "name" })}</Field>
              <Field label="Pincode" error={errors.pincode?.message}>{input("pincode", { inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}</Field>
              <div className="flex items-end pb-3 text-sm" aria-live="polite">
                {pin && (pin.serviceable
                  ? <span className="flex items-center gap-2 text-success"><Truck size={15} aria-hidden /> {pin.message}</span>
                  : <span className="text-danger">{pin.message}</span>)}
              </div>
              <Field label="House / flat number and street" error={errors.line1?.message} className="sm:col-span-2">{input("line1", { autoComplete: "address-line1" })}</Field>
              <Field label="Area / locality (optional)">{input("line2", { autoComplete: "address-line2" })}</Field>
              <Field label="Landmark (optional)">{input("landmark")}</Field>
              <Field label="City" error={errors.city?.message}>{input("city", { autoComplete: "address-level2" })}</Field>
              <Field label="State" error={errors.state?.message}>{input("state", { autoComplete: "address-level1" })}</Field>
            </div>
            {user && (
              <label className="mt-3 flex items-center gap-2.5 text-sm text-mocha">
                <input type="checkbox" {...register("save_address")} className="h-4 w-4 accent-[#7B4F3A]" /> Save this address to my account
              </label>
            )}
          </section>

          <section aria-labelledby="co-shipping">
            <h2 id="co-shipping" className="mb-4 text-2xl">3. Delivery speed</h2>
            <div className="space-y-3" role="radiogroup" aria-labelledby="co-shipping">
              <Choice
                name="shipping" checked={shipping === "standard"} onSelect={() => setShipping("standard")} icon={<Truck size={20} strokeWidth={1.4} />}
                title="Standard" text={pin?.standard_eta ? `Arrives ${pin.standard_eta}` : `${site?.standard_delivery_days ?? "5-7"} working days`}
                right={Number(cart.free_shipping_remaining) <= 0 ? "Free" : formatINR(site?.standard_shipping_rate ?? 79)}
              />
              <Choice
                name="shipping" checked={shipping === "express"} onSelect={() => setShipping("express")} icon={<Zap size={20} strokeWidth={1.4} />}
                title="Express" text={pin?.express_eta ? `Arrives ${pin.express_eta}` : `${site?.express_delivery_days ?? "2-3"} working days`}
                right={formatINR(shipping === "express" ? cart.shipping : expressExtra)}
              />
            </div>
          </section>

          <section aria-labelledby="co-payment">
            <h2 id="co-payment" className="mb-4 text-2xl">4. Payment</h2>
            <div className="space-y-3" role="radiogroup" aria-labelledby="co-payment">
              {online("razorpay") && (
                <Choice
                  name="payment" checked={payment === "razorpay"} onSelect={() => setPayment("razorpay")} icon={<CreditCard size={20} strokeWidth={1.4} />}
                  title="UPI, cards, netbanking & wallets"
                  text={site?.payments_sandbox ? "Sandbox mode: no real money is taken" : "Secured by Razorpay"}
                />
              )}
              <Choice
                name="payment" checked={payment === "cod"} onSelect={() => setPayment("cod")} disabled={!codAllowed} icon={<Banknote size={20} strokeWidth={1.4} />}
                title="Cash on Delivery"
                text={codAllowed ? "Pay in cash when your order arrives" : (pin && !pin.cod_available ? "Not available for this pincode" : cart.cod_unavailable_reason)}
                right={codAllowed && Number(site?.cod_fee) > 0 ? `+${formatINR(site?.cod_fee)}` : undefined}
              />
              {online("stripe") && (
                <Choice
                  name="payment" checked={payment === "stripe"} onSelect={() => setPayment("stripe")} icon={<Globe size={20} strokeWidth={1.4} />}
                  title="International card" text="Secured by Stripe"
                />
              )}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Order summary">
          <div className="rounded-[22px] bg-cream/80 p-6">
            <h2 className="mb-4 text-2xl">Your order</h2>
            <ul className="mb-5 max-h-[280px] space-y-3 overflow-y-auto pr-1">
              {cart.items.map((line) => (
                <li key={line.id} className="flex items-center gap-3">
                  <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ivory">
                    <Image src={media(line.image)} alt="" fill sizes="48px" className="object-cover" />
                    <span className="absolute -right-0 -top-0 grid h-5 min-w-5 place-items-center rounded-full bg-mocha px-1 text-[0.62rem] font-bold text-ivory">{line.quantity}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-lg leading-tight">{line.name}</span>
                    <span className="text-xs text-mocha">{line.variant_label}</span>
                  </span>
                  <span className="text-sm font-bold">{formatINR(line.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="mb-5 space-y-3 border-t hairline pt-5">
              <CodeForm kind="coupon" cart={cart} />
              <CodeForm kind="gift-card" cart={cart} />
            </div>
            <TotalsRows cart={cart} />
            {cart.issues.map((issue) => <p key={issue} role="alert" className="mt-3 rounded-xl bg-blush/70 px-4 py-2.5 text-sm">{issue}</p>)}
            <Button type="submit" full size="lg" className="mt-6" loading={placing}>
              <Lock size={15} aria-hidden />
              {payment === "cod" ? `Place order · ${formatINR(cart.total)}` : `Pay ${formatINR(cart.total)}`}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-mocha">
              <ShieldCheck size={14} aria-hidden /> Encrypted and secure. By ordering you agree to our <Link href="/terms-and-conditions" className="underline">terms</Link>.
            </p>
          </div>
        </aside>
      </form>

      <Sheet open={Boolean(sandbox)} onClose={() => setSandbox(null)} side="center" title="Sandbox payment" className="!max-w-[440px]">
        {sandbox && (
          <div className="px-7 pb-8 text-center">
            <p className="mx-auto mb-4 inline-block rounded-full bg-light-gold px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-espresso">Test mode</p>
            <p className="font-serif text-5xl text-deep">{formatINR(sandbox.session.amount)}</p>
            <p className="mt-2 text-sm text-mocha">
              Order {sandbox.order.number}. No Razorpay keys are configured, so this stands in for the payment window. No real money moves.
            </p>
            <div className="mt-6 space-y-3">
              <Button full size="lg" onClick={() => sandboxPay("success")}>Simulate successful payment</Button>
              <Button full variant="outline" onClick={() => sandboxPay("failure")}>Simulate a failed payment</Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
