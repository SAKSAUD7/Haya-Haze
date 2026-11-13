"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { Sheet } from "@/components/ui/Sheet";
import { useCart, useMounted, useUser } from "@/lib/hooks";
import type { Collection, SiteConfig } from "@/lib/types";
import { cn, media } from "@/lib/utils";
import { useUI, useWishlist } from "@/stores/ui";

const HELP_LINKS = [
  { label: "Our Story", href: "/about" },
  { label: "Journal", href: "/journal" },
  { label: "Lookbook", href: "/lookbook" },
  { label: "Size Guide", href: "/size-guide" },
  { label: "Track Order", href: "/track-order" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export function AnnouncementBar({ site }: { site: SiteConfig }) {
  const items = site.announcements ?? [];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 4800);
    return () => clearInterval(timer);
  }, [items.length]);
  if (items.length === 0) return null;
  const item = items[index % items.length];
  return (
    <div className="relative z-[41] h-9 overflow-hidden bg-espresso text-cream" role="region" aria-label="Announcements">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={index}
          className="absolute inset-0 flex items-center justify-center truncate whitespace-nowrap px-4 text-center text-[0.62rem] uppercase tracking-[0.1em] sm:text-[0.7rem] sm:tracking-[0.2em]"
          initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {item.link ? <Link href={item.link} className="hover:text-light-gold">{item.text}</Link> : item.text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function IconButton({ label, onClick, href, children, id }: { label: string; onClick?: () => void; href?: string; children: React.ReactNode; id?: string }) {
  const className = "relative grid h-11 w-10 shrink-0 place-items-center rounded-full text-deep transition-colors duration-300 hover:bg-cream sm:w-11";
  if (href) return <Link href={href} aria-label={label} className={className} id={id}>{children}</Link>;
  return <button type="button" aria-label={label} onClick={onClick} className={className} id={id}>{children}</button>;
}

function Count({ value, pulse }: { value: number; pulse?: number }) {
  if (!value) return null;
  return (
    <motion.span
      key={pulse}
      initial={{ scale: 1.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 14 }}
      className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-mocha px-1 text-[0.62rem] font-bold text-ivory"
    >
      {value}
    </motion.span>
  );
}

export function Header({ site, collections }: { site: SiteConfig; collections: Collection[] }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const { data: cart } = useCart();
  const { user } = useUser();
  const wishlistCount = useWishlist((s) => s.ids.length);
  const { openCart, setMenu, menuOpen, setSearch, cartPulse } = useUI();
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const featured = collections.filter((c) => c.is_featured);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    setMega(false);
    setMenu(false);
  }, [pathname, setMenu]);

  return (
    <>
      <AnnouncementBar site={site} />
      <header
        className={cn(
          "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-500",
          scrolled || mega ? "bg-ivory/90 shadow-[0_1px_0_0_rgb(201_168_76/0.25)] backdrop-blur-xl" : "bg-transparent",
        )}
        onMouseLeave={() => setMega(false)}
      >
        <div className="container-page flex h-[68px] items-center justify-between gap-1 !px-3 sm:gap-4 sm:!px-5 md:h-20 md:!px-10">
          <div className="flex flex-1 items-center lg:hidden">
            <IconButton label="Open menu" onClick={() => setMenu(true)}><Menu size={22} strokeWidth={1.4} /></IconButton>
            <IconButton label="Search" onClick={() => setSearch(true)}><Search size={20} strokeWidth={1.4} /></IconButton>
          </div>

          <Link href="/" aria-label="Haya & Haze home" className="min-w-0 shrink-0">
            <Logo variant="inline" />
          </Link>

          <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-9 text-[0.76rem] font-bold uppercase tracking-[0.2em] text-deep">
              <li>
                <button
                  type="button" aria-expanded={mega} aria-controls="mega-menu"
                  onMouseEnter={() => setMega(true)} onFocus={() => setMega(true)} onClick={() => setMega((v) => !v)}
                  className="link-underline py-7 uppercase tracking-[0.2em]"
                >
                  Shop
                </button>
              </li>
              {[
                { label: "New In", href: "/collections/all?sort=newest" },
                { label: "Haya Luxe", href: "/collections/haya-luxe" },
                { label: "Lookbook", href: "/lookbook" },
                { label: "Journal", href: "/journal" },
                { label: "Our Story", href: "/about" },
              ].map((link) => (
                <li key={link.href} onMouseEnter={() => setMega(false)}>
                  <Link href={link.href} className="py-7 transition-colors hover:text-mocha">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-1 items-center justify-end lg:flex-none">
            <span className="hidden lg:block">
              <IconButton label="Search" onClick={() => setSearch(true)}><Search size={20} strokeWidth={1.4} /></IconButton>
            </span>
            <span className="hidden sm:block">
              <IconButton label={user ? "Your account" : "Sign in"} href={user ? "/account" : "/account/login"}>
                <User size={20} strokeWidth={1.4} />
              </IconButton>
            </span>
            <IconButton label={`Wishlist${mounted && wishlistCount ? `, ${wishlistCount} items` : ""}`} href="/wishlist">
              <Heart size={20} strokeWidth={1.4} />
              {mounted && <Count value={wishlistCount} />}
            </IconButton>
            <IconButton label={`Open bag${cart?.item_count ? `, ${cart.item_count} items` : ""}`} onClick={openCart} id="cart-icon">
              <ShoppingBag size={20} strokeWidth={1.4} />
              <Count value={cart?.item_count ?? 0} pulse={cartPulse} />
            </IconButton>
          </div>
        </div>

        <AnimatePresence>
          {mega && (
            <motion.div
              id="mega-menu"
              className="absolute inset-x-0 top-full hidden border-t hairline bg-ivory/95 shadow-soft backdrop-blur-xl lg:block"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="container-page grid grid-cols-[220px_1fr] gap-12 py-10">
                <div>
                  <p className="eyebrow mb-4">Shop</p>
                  <ul className="space-y-2.5 font-serif text-2xl">
                    <li><Link href="/collections/all" className="hover:text-mocha">Shop everything</Link></li>
                    <li><Link href="/collections/all?sort=newest" className="hover:text-mocha">New arrivals</Link></li>
                    <li><Link href="/collections/all?sort=bestselling" className="hover:text-mocha">Bestsellers</Link></li>
                    <li><Link href="/collections/under-999" className="hover:text-mocha">Under ₹999</Link></li>
                  </ul>
                </div>
                <ul className="grid grid-cols-4 gap-5">
                  {featured.slice(0, 4).map((c, i) => (
                    <motion.li
                      key={c.slug} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link href={`/collections/${c.slug}`} className="group block">
                        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-cream">
                          <Image
                            src={media(c.image)} alt="" fill sizes="240px"
                            className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-fabric)] group-hover:scale-105"
                          />
                        </div>
                        <p className="mt-3 font-serif text-xl leading-tight">{c.name}</p>
                        <p className="text-sm text-mocha">{c.tagline}</p>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenu(false)} side="left" title="Menu">
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-6 pb-8">
          <p className="eyebrow mb-3 mt-2">Collections</p>
          <ul className="space-y-1">
            <li><Link href="/collections/all" className="block py-2 font-serif text-[1.7rem] leading-tight">Shop everything</Link></li>
            {featured.map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`} className="block py-2 font-serif text-[1.7rem] leading-tight">{c.name}</Link>
              </li>
            ))}
          </ul>
          <p className="eyebrow mb-3 mt-8">Explore</p>
          <ul className="grid grid-cols-2 gap-x-4 text-[0.95rem] text-deep">
            {HELP_LINKS.map((link) => (
              <li key={link.href}><Link href={link.href} className="block py-2">{link.label}</Link></li>
            ))}
          </ul>
          <div className="mt-8 border-t hairline pt-6">
            <Link href={user ? "/account" : "/account/login"} className="flex items-center gap-3 py-2 text-deep">
              <User size={18} strokeWidth={1.4} /> {user ? `Hello, ${user.first_name || "there"}` : "Sign in or create an account"}
            </Link>
          </div>
        </nav>
      </Sheet>
    </>
  );
}
