"use client";

import { Check, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { useSite } from "@/lib/hooks";

export default function ContactPage() {
  const site = useSite();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Contact us | Haya & Haze";
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setState("busy");
    setErrors({});
    try {
      const result = await api<{ detail: string }>("/contact/", { method: "POST", body: form });
      setMessage(result.detail);
      setState("done");
    } catch (error) {
      setState("idle");
      if (error instanceof ApiError && Object.keys(error.fields).length) setErrors(error.fields);
      else setErrors({ form: errorMessage(error) });
    }
  };

  const whatsapp = site?.whatsapp_number ? `https://wa.me/${site.whatsapp_number}?text=${encodeURIComponent(site.whatsapp_message)}` : null;
  const channels = [
    whatsapp && { icon: MessageCircle, label: "WhatsApp", value: "Chat with us", href: whatsapp },
    site?.contact_email && { icon: Mail, label: "Email", value: site.contact_email, href: `mailto:${site.contact_email}` },
    site?.contact_phone && { icon: Phone, label: "Phone", value: site.contact_phone, href: `tel:${site.contact_phone.replace(/\s/g, "")}` },
    site?.instagram_url && { icon: Instagram, label: "Instagram", value: "@hayaandhaze", href: site.instagram_url },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string }[];

  return (
    <div className="grain -mt-[68px] bg-gradient-to-b from-blush via-ivory to-ivory pt-[68px] md:-mt-20 md:pt-20">
      <div className="container-page grid gap-12 py-12 md:grid-cols-2 md:gap-20 md:py-20">
        <div>
          <p className="eyebrow mb-4">Say salaam</p>
          <h1 className="text-5xl md:text-7xl">We would love to hear from you</h1>
          <p className="mt-5 max-w-md text-[1.05rem] text-mocha">
            A question about sizing, an order, or which fabric suits the season: ask away. We reply within one working day.
          </p>
          <ul className="mt-9 space-y-3">
            {channels.map(({ icon: Icon, label, value, href }) => (
              <li key={label}>
                <a
                  href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-2xl border hairline bg-ivory/70 p-4 transition hover:bg-cream"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-cream text-mocha"><Icon size={19} strokeWidth={1.4} aria-hidden /></span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.18em] text-mocha">{label}</span>
                    <span className="font-bold text-deep">{value}</span>
                  </span>
                </a>
              </li>
            ))}
            {site?.address && (
              <li className="flex items-start gap-4 p-4 text-mocha">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream"><MapPin size={19} strokeWidth={1.4} aria-hidden /></span>
                <span className="whitespace-pre-line">{site.address}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-[26px] border hairline bg-ivory/90 p-7 shadow-soft md:p-9">
          {state === "done" ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center" role="status">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-cream text-success"><Check size={28} aria-hidden /></span>
              <h2 className="mt-5 text-3xl">Message sent</h2>
              <p className="mt-2 text-mocha">{message}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-3xl">Send a message</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-mocha">Your name
                  <input name="name" required className="field mt-1.5" autoComplete="name" />
                </label>
                <label className="block text-sm text-mocha">Email
                  <input name="email" type="email" required className="field mt-1.5" autoComplete="email" aria-invalid={Boolean(errors.email)} />
                  {errors.email && <span className="mt-1 block text-xs text-danger" role="alert">{errors.email}</span>}
                </label>
              </div>
              <label className="block text-sm text-mocha">Phone <span className="text-xs">(optional)</span>
                <input name="phone" className="field mt-1.5" autoComplete="tel" />
              </label>
              <label className="block text-sm text-mocha">Subject <span className="text-xs">(optional)</span>
                <input name="subject" className="field mt-1.5" placeholder="Order number, sizing, wholesale…" />
              </label>
              <label className="block text-sm text-mocha">How can we help?
                <textarea name="message" required rows={5} className="field mt-1.5 resize-none" />
              </label>
              {errors.form && <p className="text-sm text-danger" role="alert">{errors.form}</p>}
              <Button type="submit" full size="lg" loading={state === "busy"}>Send message</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
