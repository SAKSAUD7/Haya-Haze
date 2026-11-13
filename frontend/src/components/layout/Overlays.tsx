"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Monogram } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { CONSENT_KEY } from "@/lib/analytics";
import type { SiteConfig } from "@/lib/types";

import { NewsletterForm } from "./NewsletterForm";

const QUIET_PATHS = ["/checkout", "/account/login", "/account/register"];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) */
  }
}

export function WhatsAppButton({ site }: { site: SiteConfig }) {
  const pathname = usePathname();
  if (!site.whatsapp_number || pathname.startsWith("/checkout")) return null;
  const href = `https://wa.me/${site.whatsapp_number}?text=${encodeURIComponent(site.whatsapp_message || "")}`;
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#1F8F4E] text-white shadow-lift transition-transform duration-500 ease-[var(--ease-fabric)] hover:scale-110 max-md:bottom-20"
    >
      <MessageCircle size={26} strokeWidth={1.6} aria-hidden />
    </a>
  );
}

export function CookieConsent({ site }: { site: SiteConfig }) {
  const [choice, setChoice] = useState<string | null>("pending");
  useEffect(() => setChoice(read(CONSENT_KEY)), []);
  const decide = (value: "accepted" | "declined") => {
    write(CONSENT_KEY, value);
    setChoice(value);
  };
  const ga = site.ga4_measurement_id;
  const pixel = site.meta_pixel_id;
  return (
    <>
      {/* Analytics load only after consent, and only if IDs are set in Store settings. */}
      {choice === "accepted" && ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {choice === "accepted" && pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
      <AnimatePresence>
        {choice === null && (
          <motion.div
            role="dialog" aria-label="Cookie preferences"
            className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border hairline bg-ivory/95 p-5 shadow-lift backdrop-blur-xl md:left-6 md:right-auto"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.7, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm text-deep">
              We use essential cookies to keep your bag and sign-in working, and, with your permission, analytics cookies
              to make the store better. See our <Link href="/privacy-policy" className="underline underline-offset-4">privacy policy</Link>.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => decide("accepted")}>Accept all</Button>
              <Button size="sm" variant="outline" onClick={() => decide("declined")}>Essential only</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const POPUP_KEY = "hh-welcome-popup";
const POPUP_REST_DAYS = 14;

/** Email capture with a welcome code. Shown once, then rests for two weeks. */
export function WelcomePopup({ site }: { site: SiteConfig }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!site.popup_enabled || QUIET_PATHS.some((p) => pathname.startsWith(p))) return;
    const last = Number(read(POPUP_KEY) || 0);
    if (Date.now() - last < POPUP_REST_DAYS * 86_400_000) return;
    const timer = setTimeout(() => {
      // Wait until the cookie question has been answered so two prompts never stack.
      if (read(CONSENT_KEY) === null) return;
      setOpen(true);
      write(POPUP_KEY, String(Date.now()));
    }, 14_000);
    return () => clearTimeout(timer);
  }, [pathname, site.popup_enabled]);

  const copy = async () => {
    await navigator.clipboard?.writeText(code).catch(() => undefined);
    toast.success("Code copied");
  };

  return (
    <Sheet open={open} onClose={() => setOpen(false)} side="center" title={site.popup_title} hideTitle className="!max-w-[460px]">
      <div className="grain bg-gradient-to-b from-blush to-ivory px-8 pb-9 pt-12 text-center">
        <Monogram className="mx-auto h-20 w-auto" title="" />
        <h2 className="mt-5 text-4xl">{site.popup_title}</h2>
        <p className="mx-auto mt-3 max-w-xs text-mocha">{site.popup_text}</p>
        <div className="mt-7">
          {code ? (
            <div>
              <p className="mb-3 flex items-center justify-center gap-2 text-sm text-success"><Check size={16} /> You are in. Here is your code:</p>
              <button
                type="button" onClick={copy}
                className="mx-auto flex items-center gap-3 rounded-full border border-dashed border-mocha bg-white px-6 py-3 font-bold tracking-[0.2em] text-deep"
              >
                {code} <Copy size={15} aria-hidden />
              </button>
              <p className="mt-3 text-xs text-mocha">Use it at checkout on your first order.</p>
            </div>
          ) : (
            <NewsletterForm source="popup" onSubscribed={(c) => setCode(c || "WELCOME10")} />
          )}
        </div>
        {!code && (
          <button type="button" onClick={() => setOpen(false)} className="mt-5 text-sm text-mocha underline underline-offset-4">
            No thanks
          </button>
        )}
      </div>
    </Sheet>
  );
}
