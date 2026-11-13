"use client";

import { ArrowRight, Check } from "lucide-react";
import { useState, type FormEvent } from "react";

import { api, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function NewsletterForm({
  tone = "light", source = "footer", onSubscribed,
}: { tone?: "light" | "dark"; source?: string; onSubscribed?: (couponCode: string) => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState("");
  const dark = tone === "dark";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("busy");
    setMessage("");
    try {
      const result = await api<{ detail: string; coupon_code: string }>("/newsletter/", { method: "POST", body: { email, source } });
      setState("done");
      setMessage(result.detail);
      onSubscribed?.(result.coupon_code);
    } catch (error) {
      setState("idle");
      setMessage(errorMessage(error));
    }
  };

  if (state === "done") {
    return (
      <p className={cn("flex items-center gap-2 text-sm", dark ? "text-light-gold" : "text-success")} role="status">
        <Check size={16} aria-hidden /> {message}
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate={false}>
      <div
        className={cn(
          "flex items-center rounded-full border p-1 transition-colors focus-within:border-camel",
          dark ? "border-cream/30 bg-cream/5" : "border-sand bg-white",
        )}
      >
        <label htmlFor={`newsletter-${source}`} className="sr-only">Email address</label>
        <input
          id={`newsletter-${source}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address" autoComplete="email"
          className={cn(
            "h-11 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none",
            dark ? "text-cream placeholder:text-cream/55" : "text-deep placeholder:text-mocha/60",
          )}
        />
        <button
          type="submit" disabled={state === "busy"} aria-label="Subscribe"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-60",
            dark ? "bg-camel text-espresso hover:bg-light-gold" : "bg-mocha text-ivory hover:bg-deep",
          )}
        >
          <ArrowRight size={18} strokeWidth={1.6} />
        </button>
      </div>
      {message && <p className={cn("mt-2 text-sm", dark ? "text-rose" : "text-danger")} role="alert">{message}</p>}
    </form>
  );
}
