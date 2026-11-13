import { Instagram, Lock, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { WaveDivider } from "@/components/ui/bits";
import type { Collection, SiteConfig } from "@/lib/types";

import { NewsletterForm } from "./NewsletterForm";

const HELP = [
  ["Track your order", "/track-order"], ["Size guide", "/size-guide"], ["FAQ", "/faq"], ["Contact us", "/contact"],
  ["Returns & exchanges", "/account/returns"],
];
const POLICIES = [
  ["Shipping policy", "/shipping-policy"], ["Returns & refunds", "/returns-and-refunds"],
  ["Cancellation policy", "/cancellation-policy"], ["Privacy policy", "/privacy-policy"],
  ["Terms & conditions", "/terms-and-conditions"],
];

function TikTok() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 5 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.4-1.5Z" />
    </svg>
  );
}
function Pinterest() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M10.2 20.5 12 11.5M9.2 13.6c-1.6-3 .2-6.1 3.2-6.1 2.600 0 4 1.900 3.600 4.200-.4 2.300-2 3.800-3.600 3.400-.7-.2-1.100-.7-1.200-1.200" />
    </svg>
  );
}

function PaymentBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-cream/25 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-cream/85">
      {children}
    </span>
  );
}

export function Footer({ site, collections }: { site: SiteConfig; collections: Collection[] }) {
  const linkClass = "text-cream/80 transition-colors hover:text-light-gold";
  const whatsapp = site.whatsapp_number ? `https://wa.me/${site.whatsapp_number}` : null;
  return (
    <footer className="grain mt-24 bg-espresso text-cream">
      <WaveDivider color="var(--color-gold)" className="-translate-y-4 opacity-70" />
      <div className="container-page pb-10 pt-8">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_2fr]">
          <div>
            <Logo variant="lockup" tone="light" className="!items-start" />
            <p className="mt-6 max-w-sm font-display text-xl italic leading-snug text-cream/90">{site.tagline}</p>
            <div className="mt-8 max-w-sm">
              <p className="mb-3 text-sm text-cream/80">New drops, styling notes and quiet reminders. No noise.</p>
              <NewsletterForm tone="dark" source="footer" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            <nav aria-label="Collections">
              <h2 className="eyebrow mb-4 !text-light-gold">Collections</h2>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/collections/all" className={linkClass}>Shop everything</Link></li>
                {collections.filter((c) => c.is_featured).map((c) => (
                  <li key={c.slug}><Link href={`/collections/${c.slug}`} className={linkClass}>{c.name}</Link></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Help">
              <h2 className="eyebrow mb-4 !text-light-gold">Help</h2>
              <ul className="space-y-2.5 text-sm">
                {HELP.map(([label, href]) => <li key={href}><Link href={href} className={linkClass}>{label}</Link></li>)}
              </ul>
            </nav>
            <nav aria-label="Policies">
              <h2 className="eyebrow mb-4 !text-light-gold">Policies</h2>
              <ul className="space-y-2.5 text-sm">
                {POLICIES.map(([label, href]) => <li key={href}><Link href={href} className={linkClass}>{label}</Link></li>)}
              </ul>
            </nav>
            <div>
              <h2 className="eyebrow mb-4 !text-light-gold">Say salaam</h2>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href={`mailto:${site.contact_email}`} className={`${linkClass} flex items-center gap-2 break-all`}>
                    <Mail size={15} strokeWidth={1.4} aria-hidden className="shrink-0" /> {site.contact_email}
                  </a>
                </li>
                {site.contact_phone && (
                  <li>
                    <a href={`tel:${site.contact_phone.replace(/\s/g, "")}`} className={`${linkClass} flex items-center gap-2`}>
                      <Phone size={15} strokeWidth={1.4} aria-hidden /> {site.contact_phone}
                    </a>
                  </li>
                )}
                {whatsapp && (
                  <li>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${linkClass} flex items-center gap-2`}>
                      <MessageCircle size={15} strokeWidth={1.4} aria-hidden /> WhatsApp us
                    </a>
                  </li>
                )}
                {site.address && <li className="whitespace-pre-line text-cream/65">{site.address}</li>}
              </ul>
              <div className="mt-5 flex gap-2">
                {[
                  { href: site.instagram_url, label: "Instagram", icon: <Instagram size={18} strokeWidth={1.4} /> },
                  { href: site.tiktok_url, label: "TikTok", icon: <TikTok /> },
                  { href: site.pinterest_url, label: "Pinterest", icon: <Pinterest /> },
                ].filter((s) => s.href).map((s) => (
                  <a
                    key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Haya & Haze on ${s.label}`}
                    className="grid h-10 w-10 place-items-center rounded-full border border-cream/25 text-cream/85 transition hover:border-light-gold hover:text-light-gold"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-cream/15 pt-7 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1.5 text-xs text-cream/85">
              <Lock size={13} aria-hidden /> Secure checkout
            </span>
            {["UPI", "Visa", "Mastercard", "RuPay", "Netbanking", "COD"].map((m) => <PaymentBadge key={m}>{m}</PaymentBadge>)}
          </div>
          <p className="text-xs text-cream/65">
            © {new Date().getFullYear()} {site.store_name}. Made with care in India.
          </p>
        </div>
      </div>
    </footer>
  );
}
