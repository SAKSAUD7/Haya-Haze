import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Lato, Playfair_Display } from "next/font/google";

import { CartDrawer, FlyToCart } from "@/components/cart/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CookieConsent, WelcomePopup, WhatsAppButton } from "@/components/layout/Overlays";
import { Providers } from "@/components/layout/Providers";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { QuickView } from "@/components/product/QuickView";
import { api } from "@/lib/api/server";
import { SITE_URL } from "@/lib/utils";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap",
});
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const site = await api.site();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.seo_title || "Haya & Haze", template: "%s | Haya & Haze" },
    description: site.seo_description,
    applicationName: "Haya & Haze",
    openGraph: {
      type: "website", siteName: "Haya & Haze", locale: "en_IN", url: SITE_URL,
      title: site.seo_title, description: site.seo_description, images: ["/brand/og.png"],
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
    icons: { icon: "/brand/favicon.svg", apple: "/brand/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#FFF8F6", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [site, collections] = await Promise.all([api.site(), api.collections()]);
  const organization = {
    "@context": "https://schema.org", "@type": "Organization", name: site.store_name, url: SITE_URL,
    logo: `${SITE_URL}/brand/logo-lockup.svg`, slogan: site.tagline, email: site.contact_email,
    sameAs: [site.instagram_url, site.tiktok_url, site.pinterest_url].filter(Boolean),
  };
  return (
    <html lang="en-IN" className={`${cormorant.variable} ${lato.variable} ${playfair.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-deep focus:px-5 focus:py-3 focus:text-ivory"
        >
          Skip to content
        </a>
        <Providers site={site}>
          <Header site={site} collections={collections} />
          <main id="main" className="min-h-[60vh]">{children}</main>
          <Footer site={site} collections={collections} />
          <CartDrawer />
          <QuickView />
          <SearchOverlay />
          <FlyToCart />
          <WhatsAppButton site={site} />
          <CookieConsent site={site} />
          <WelcomePopup site={site} />
        </Providers>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      </body>
    </html>
  );
}
