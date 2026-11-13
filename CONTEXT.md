# Haya & Haze — Project Context

This file is the single source of truth for the build: the brand guide, the full build
specification (the original prompt with the "Fabric in Motion" revision merged in), the
architecture decisions, and the build walkthrough with current status. Read it before
changing anything.

Contents

1. Brand guide
2. Build specification (merged)
3. Architecture and repo layout
4. Decisions and deviations from the spec
5. Build walkthrough and status
6. Reference notes (systems, not UI)

---

## 1. Brand guide

**Haya & Haze** — Modest Fashion | Hijabs & Modest Wear. Opening line of the brand
document: *Bismillah hir rahman nir rahim* (In the name of Allah, the Most Gracious, the
Most Merciful).

### 1.1 Name

- **Haya (حياء)** — Arabic for modesty, dignity and inner beauty; a core value in Islam,
  the grace and self-respect every woman carries.
- **Haze** — softness, dreaminess, the ethereal quality of fabric in motion; the visual
  feeling of a beautifully draped hijab.

Together: a woman grounded in her values yet fluid in her expression — modest, elegant,
unapologetically herself.

| | |
|---|---|
| Founded | 2025 |
| Category | Modest Fashion — Hijabs & Modest Wear |
| Primary channel | Social media first (Instagram, TikTok) |
| Target market | All ages — teens to mature women |
| Brand style | Elegant, modern, everyday luxury |

### 1.2 Essence

- **Mission:** To craft hijabs and modest wear that honour faith, celebrate beauty and
  inspire every woman to show up as her most confident self.
- **Vision:** To become the go-to modest fashion brand for women across all ages and
  cultures, known for quality, elegance, and an authentic celebration of hijab.
- **Core values:** Modesty · Elegance · Inclusivity · Authenticity · Quality.
- **Tone of voice:** Warm, empowering, elegant — never preachy. Confident, graceful,
  modern, relatable. Feels like advice from a stylish older sister. Avoid overly
  religious, salesy or exclusionary language.

### 1.3 Taglines

- Primary: **"Draped in Grace. Defined by You."**
- Alternatives: "Where Modesty Meets Modern." · "Soft. Bold. Beautifully Covered." ·
  "Wear Your Values. Own Your Style." · "For Every Woman. Every Occasion. Every Haya."
- Palette-sheet line: "You deserve to get dressed and feel completely yourself." ·
  GRACEFUL · COVERED · BEAUTIFUL

### 1.4 Colour

Core brand palette

| Hex | Name | Use |
|---|---|---|
| `#C8A882` | Warm Camel | Primary brand colour |
| `#E8D5C4` | Blush Sand | Backgrounds, soft highlights, packaging |
| `#FAF6F2` | Ivory Cream | Page backgrounds, minimal spaces |
| `#B0AEB2` | Soft Silver | Modern accents, metallic details |
| `#3D2B1F` | Deep Espresso | Text, headings, strong contrast |
| `#D4B8A0` | Rose Nude | Secondary warm tone, product photography background |

Website families

- **Blush & Rose** (hero, product cards, backgrounds): `#FFF8F6` Ivory White · `#F2D4D0`
  Soft Blush · `#E8B4A8` Rose Nude · `#D4878A` Deep Blush · `#C47E7E` Dusty Rose
- **Deep Mocha** (buttons, headings, logo, text): `#F5EDE4` Cream Foam · `#C49A7A` Latte ·
  `#C8A882` Warm Camel · `#7B4F3A` Warm Mocha · `#4A2C2A` Deep Mocha
- **Gold & Silver** (accents, borders, icons): `#F5F0E8` Champagne · `#E8D5A8` Light Gold ·
  `#C9A84C` Gold Drizzle · `#D6D6D6` Cool Grey · `#B0AEB2` Soft Silver
- **Dark Depths** (footer, dark sections): `#2C4A3E` Deep Forest · `#1E2A4A` Midnight Navy ·
  `#3D2B1F` Espresso · `#4A4A4A` Charcoal · `#1A1A1A` Jet Black

Signature website combination

| Role | Hex |
|---|---|
| Page background | `#FFF8F6` Ivory White |
| Hero section | `#F2D4D0` Soft Blush |
| Primary button | `#C8A882` Warm Camel |
| CTA button | `#7B4F3A` Warm Mocha |
| Headings | `#4A2C2A` Deep Mocha |
| Gold accent | `#C9A84C` Gold Drizzle |
| Premium sections | `#2C4A3E` Deep Forest |
| Footer | `#3D2B1F` Espresso |

Every text/background pair must pass WCAG AA. Note: white text on Warm Camel fails AA, so
camel buttons carry Deep Mocha text.

### 1.5 Typography

- Headings, logo, taglines: **Cormorant Garamond** (fallback Georgia)
- Body, UI, descriptions: **Lato** (fallback Arial)
- Campaigns and quotes: **Playfair Display**
- Clean and elegant; never decorative or overly scripted; no all-caps body text.

### 1.6 Logo

Client reference (supplied as an image): a lowercase serif **"hh" monogram** — a dark
taupe `h` and a lighter camel `h` — joined by a line-drawn figure in a hijab seen from
behind, her drape flowing down between the letters. Beneath it the lowercase wordmark
"haya & haze" and a small spaced caption "HIJAB & ABAYA" between two hairlines, on a
blush-cream ground.

Implementation: one swappable component, `frontend/src/components/brand/Logo.tsx`, with
assets in `frontend/public/brand/` (full lockup, wordmark, monogram, light and dark
versions, favicon). Replace the files there when final artwork arrives.

### 1.7 Products

| Category | Collection | Description |
|---|---|---|
| Scarves & Wraps | **The Haze Collection** | Soft, draped, everyday essentials |
| Instant Hijabs | **The Haya Basics** | Effortless modesty for busy women |
| Premium Silk Hijabs | **Haya Luxe** | Elevated silk pieces for special occasions |
| Full Modest Wear | **The Covered Edit** | Abayas, modest dresses and sets |

### 1.8 Social and contact

Instagram / TikTok / Pinterest `@hayaandhaze` · www.hayaandhaze.com ·
hello@hayaandhaze.com · WhatsApp Business (number set in the admin).

Content pillars: Product 40% · Lifestyle 25% · Community 20% · Values 15%.
Brand hashtags: #HayaAndHaze #HayaHaze #TheHazeCollection #HayaLuxe.

### 1.9 Copy to use verbatim

Hero:

> Comfortable enough to forget.
> Beautiful enough to remember.
> This is Haya & Haze.

About Us:

> Haya & Haze was created with one simple truth: modesty and beauty have always belonged
> together. The name says it all. Haya — the Arabic word for modesty, dignity, and inner
> grace. Haze — the soft, effortless beauty of fabric that moves with you. Together, they
> represent the woman we design for. A woman who is rooted in her values, expressive in
> her style, and completely at ease in who she is.
>
> We design hijabs and modest wear for women who want to get dressed and simply feel good.
> No compromise, no overthinking — just pieces that are elegant, comfortable, and made for
> real life. From quiet weekday mornings to special occasions, every Haya & Haze piece is
> thoughtfully crafted to feel as beautiful as it looks.
>
> We believe modest fashion should feel like you — timeless, personal, and effortlessly
> graceful. Because when a woman feels good in what she wears, she shows up differently.
> Softer where she wants to be. Stronger where it matters.
>
> This is not just a brand. It is a space where faith, femininity and fashion come
> together — naturally, beautifully, unapologetically.
>
> Draped in Grace. Defined by You. — The Haya & Haze Family

### 1.10 Business requirements from the brand document

Market is India first: INR, GST, Cash on Delivery essential; Razorpay primary, Stripe /
PayPal for wider acceptance, Tabby / Tamara (BNPL) later. Couriers: Delhivery, Shiprocket,
BlueDart or DTDC; standard 5–7 days, express 2–3 days; free-shipping threshold. Legal
pages: Privacy, Terms, Returns & Refunds, Shipping. Pages: Home, Shop/Collection, Product,
About, Contact, FAQ, Cart & Checkout. Marketing: Google Analytics, Meta Pixel, SEO basics,
email-capture popup, WhatsApp chat button. Trust: SSL, reviews, secure-checkout badge,
visible contact information.

---

## 2. Build specification (merged)

The original build prompt with sections 4–6 replaced by the Fabric in Motion revision and
its four follow-up edits applied.

### 2.1 Goal

A production-ready, end-to-end e-commerce platform: Next.js storefront, Django backend,
admin portal and CMS, in one monorepo. The UI must feel like a luxury fashion house —
soft, airy, elegant, animated — never a generic template. Reference
https://ovaisabayacollection.in/ and leading modest-fashion / D2C stores (Shopify Dawn
stores, Modanisa, Haute Hijab, Inayah, Aab) for **functional patterns only**; the UI is
100% original.

### 2.2 Design system

- Colour tokens as CSS variables / Tailwind theme (section 1.4).
- Generous whitespace, 12–20px radii, hairline gold or silver borders, subtle grain.
- Motion feels like fabric: slow eases `cubic-bezier(0.22, 1, 0.36, 1)`, drift, float,
  staggered reveals. Lenis smooth scroll, scroll reveals, magnetic buttons, image hover
  crossfade, page transitions. Respect `prefers-reduced-motion` everywhere.

### 2.3 Stack

Frontend (`/frontend`): Next.js 15 App Router, strict TypeScript, RSC/ISR for catalogue
pages, Tailwind CSS, Radix primitives styled to the brand, Framer Motion, Lenis, Three.js
+ React Three Fiber + drei, TanStack Query, Zustand, React Hook Form + Zod, a typed API
client generated from the Django OpenAPI schema, Next/Image.

Backend (`/backend`): Python 3.12 (3.11 compatible), Django 5.x, DRF, PostgreSQL
(full-text search + trigram), dj-rest-auth + django-allauth (email/password, email OTP,
Google) with JWT in HTTP-only cookies, guest carts by cart token, Django admin themed
with django-unfold, Wagtail CMS at `/cms`, Celery + Redis (+ beat), Razorpay / COD /
Stripe behind a pluggable `PaymentProvider`, Shiprocket behind a pluggable
`ShippingProvider`, django-storages for media with image renditions and **rembg
background removal (Celery) to generate transparent fabric textures**, django-anymail,
GST invoices and packing slips via WeasyPrint, django-filter, drf-spectacular (docs at
`/api/docs`), django-cors-headers, django-environ, django-import-export,
django-simple-history, DRF throttling, sentry-sdk, pytest-django + factory_boy.

Deploy: frontend on Vercel; backend on Railway / Render / DigitalOcean with managed
Postgres and Redis; `docker-compose.yml` for local development; `.env.example` for both
apps; GitHub Actions CI.

### 2.4 Fabric in Motion — the 3D engine

All 3D uses one system. There are no 3D models: every product is its real photo rendered
as living cloth — a photo-textured, high-subdivision mesh moved by a cloth vertex shader
so it drapes, sways, ripples and reacts to the cursor. Any product added in the admin
appears in 3D automatically.

**Shared `<FabricMesh />`**

- Input: product cut-out image (transparent background), fabric type, shape preset.
- Geometry: subdivided plane (64×96 desktop, 32×48 mobile) deformed in a vertex shader.
- Motion layers: *drape* (gravity, pinned at the top, free hem), *breeze* (layered
  simplex noise), *interaction* (ripple from the cursor contact point; drag adds damped
  swing computed with spring physics in JS and passed as uniforms).
- Fragment: texture with alpha, fold shading from recomputed normals, fabric-specific
  sheen and translucency.
- Shape presets: `flat`, `hanging-garment`, `draped-over-bar`, `folded`.

**Fabric physics presets** (from the product's `fabric` field)

| Fabric | Weight / flow | Look |
|---|---|---|
| Silk (Haya Luxe) | light, fluid, long waves | strong sheen, gold-tinted highlights |
| Chiffon / Georgette | very light, airy, fast flutter | slight translucency |
| Modal / Viscose | medium, soft | gentle sheen |
| Jersey (Haya Basics) | heavier, slower, smaller waves | matte |
| Crepe / Nida (abayas) | heavy, minimal sway, elegant swing | matte, fine texture |

**Image pipeline (backend):** on product image upload a Celery task removes the
background (`rembg`), generates a transparent WebP cut-out, and stores it as the
product's `fabric_texture`. The admin can preview the cut-out, replace it, and choose
shape preset and fabric type. With no cut-out, fall back to the photo on a rounded
`flat` panel.

### 2.5 Section A — Top Picks hero

- Scene: blush-to-ivory gradient, haze, drifting light particles, warm camel/gold rim
  light, soft glow.
- Top picks float as FabricMeshes on a slowly rotating 3D carousel ring. Intro: fabrics
  drift in from the haze and settle into the ring.
- Hover/focus: the piece lifts toward the camera, ripple intensifies, floating label with
  name, price and swatches. Drag/swipe rotates the ring; fabrics flutter with velocity.
- Click: Quick View panel (gallery, variants, quantity, Add to Cart). Add to Cart sends
  the product flying to the cart icon, the badge animates, the mini-cart opens.
- Foreground: hero copy with staggered word reveal; CTAs "Shop the Collection" (Mocha)
  and "Explore Haya Luxe" (Camel).
- Admin: Top Pick flag + order; headline and subtext.

### 2.6 Section B — The Haya Wardrobe

- Arched-top open wardrobe in walnut/espresso wood, cream-lacquered interior, thin gold
  trim. Two tall arched doors swing open when the section scrolls into view, warm light
  blooms out, every garment flutters once and settles.
- Polished brass rail with a small gold "HAYA & HAZE" plaque; procedural hangers.
- Abayas hang as `hanging-garment`; hijabs hang as `draped-over-bar`; some sit `folded`
  on lit shelves. Under-shelf glow, mirror panel, soft reflective floor, blush haze.
- Drag/swipe slides hangers along the rail with momentum; garments swing like damped
  pendulums according to fabric weight.
- Hover: garment eases forward, ripple, label. Click: garment lifts off the rail, floats
  toward the camera and faces the viewer; the wardrobe dims; a side panel opens (gallery,
  colour/size/length, size guide, Add to Cart, Buy Now, wishlist). Closing hangs it back.
- Category tabs (Covered Edit / Haya Luxe / Haze Collection / Haya Basics): doors close,
  rail contents swap, doors reopen with a flutter. "View all" goes to the collection.
- Admin: toggle, title/subtitle, products per rail, hanging vs shelf, wood tone
  (walnut / espresso / ivory lacquer), light warmth.
- Mobile: 4–5 hangers, swipe navigation, simplified lighting, product in a bottom sheet.

### 2.7 Fabric in Motion across the site

- Product page: "Feel the Fabric" live view — the product as a draggable FabricMesh with
  the fabric type shown ("Silk · fluid drape").
- Collection cards: fabric ripple on hover.
- Page transitions: a soft sheet of blush chiffon sweeps between routes.
- Loader: a silk ribbon waving, then the H&H monogram.
- Section dividers: a gentle animated drape line instead of straight rules.
- Slow and restrained. Fabric should breathe, never thrash.

### 2.8 3D performance and resilience (mandatory)

- Lazy-load the 3D bundle (`dynamic(..., { ssr: false })`) behind a static poster.
- One WebGL context at a time: a Canvas mounts only when its section is the most visible
  one and unmounts off-screen.
- WebGL error boundary with 2D fallbacks that keep Add to Cart: hero → Framer Motion
  carousel with CSS flutter; wardrobe → CSS-3D wardrobe with perspective doors and
  pendulum hangers; Feel the Fabric → static image with zoom.
- Lower subdivision on mobile, adaptive DPR, performance monitor auto-downgrade, shared
  hanger geometry, WebP textures, uniforms updated only when visible.
- `prefers-reduced-motion` users get the 2D layout with still fabric.
- Targets: 60fps on mid-range Android, home LCP < 2.5s, 3D JS out of the initial bundle.

### 2.9 Storefront

**Global:** rotating CMS-editable announcement bar ("Free shipping above ₹1499 · COD
available"); sticky header with logo, mega-menu, predictive search, wishlist, account,
cart badge; mobile drawer menu; mini-cart drawer with free-shipping progress, "Complete
the look" upsell, checkout CTA; floating WhatsApp button; email-capture popup (10%
welcome code, frequency-capped); cookie consent; Espresso footer with collections, help,
policies, socials, newsletter, payment and secure-checkout badges, contact.

**Home** (order editable in the Wagtail StreamField): 1 Top Picks hero · 2 Shop by
Collection (4 tilt cards) · 3 The Haya Wardrobe · 4 New Arrivals carousel · 5 "The
Meaning of Haya" story teaser (Deep Forest, Playfair quote) · 6 Haya Luxe spotlight ·
7 Bestsellers · 8 Shop the Look lookbook with hotspots · 9 Reviews carousel ·
10 Instagram/UGC grid · 11 Trust strip · 12 Newsletter.

**Collection pages:** banner, description, breadcrumbs; URL-synced filters (category,
price, colour swatches, size, fabric, occasion, in stock) and sort; product cards with
image hover swap, badges (New / Sale / Bestseller / Low Stock / Sold Out), swatches,
quick view, quick add, wishlist.

**Product page:** gallery with zoom, Feel the Fabric live view; price, compare-at with %
off, tax-inclusive note; variants colour / size (S–XXL, Free Size) / length (52–60") with
unavailable ones disabled; size guide modal; pincode delivery checker (ETA + COD); stock
urgency; back-in-stock alert; Add to Cart, Buy Now, wishlist, share; accordions
(description, fabric and care, shipping and returns); reviews with photos and
verified-buyer badge; Complete the look; You may also like; recently viewed; sticky
mobile add-to-cart bar; Product JSON-LD.

**Cart and checkout:** cart page with quantity edit, save for later, coupon, gift card,
gift wrap + note, order notes. One-page checkout with guest checkout: contact, Indian
address with pincode → city/state auto-fill, saved addresses, shipping method (Standard
5–7 days / Express 2–3 days, free above threshold), payment (Razorpay, COD with optional
fee and value limits, Stripe), GST breakdown. Server-side price, stock and coupon
validation; idempotent order creation; Razorpay signature verification on client callback
and webhook. Confirmation page plus email (and a WhatsApp template hook).

**Account:** signup/login (email, OTP, Google), forgot password; orders with status
timeline, tracking, invoice PDF, reorder; return/exchange requests with photos;
addresses; wishlist; profile; newsletter preferences.

**Content pages (Wagtail):** About, Contact (form → admin inbox + email), FAQ, Journal,
Lookbook, Size Guide, Track Order, legal pages (Privacy, Terms, Returns & Refunds,
Shipping, Cancellation) with starter content.

### 2.10 Admin portal (Django + Unfold) and CMS (Wagtail)

Roles through Django groups: Super Admin, Store Manager, Content Editor, Support.

- **Dashboard:** revenue today/week/month, orders, AOV, new customers, abandoned carts,
  COD vs prepaid; charts for sales over time, top products, sales by collection; alerts
  for low stock, pending orders, pending returns, reviews to moderate.
- **Catalogue:** products with inline variants (colour × size × length → SKU, price,
  compare-at, stock, weight), ordered media, **fabric texture preview/replace + shape
  preset + fabric type**; flags Featured / Top Pick / In Wardrobe / New / Bestseller;
  fabric, occasion, tags, related products, SEO fields, draft/scheduled publish;
  collections (manual or rule-based); CSV import/export; bulk edit; duplicate.
- **Inventory:** stock per variant, low-stock thresholds, movement history,
  back-in-stock subscribers.
- **Orders:** filters and search; workflow Pending → Confirmed → Packed → Shipped → Out
  for Delivery → Delivered (also Cancelled / Returned / Refunded); COD verification;
  Shiprocket shipment/AWB; invoice and packing-slip PDF; internal notes; Razorpay
  refunds; customer notification on each status change.
- **Customers:** profile, orders, lifetime value, tags, notes, export.
- **Marketing:** coupons (% / flat / free shipping / BOGO, minimum value, usage and
  per-customer limits, expiry, product/collection scope, auto-apply), gift cards,
  abandoned carts and recovery, subscribers, popup and announcement settings.
- **Reviews and returns:** moderation queue (approve / reject / reply / feature);
  returns queue (approve, pickup, refund or exchange).
- **Settings:** store info, logos, WhatsApp, socials, shipping rates and serviceable
  pincodes, COD rules, GST % and HSN codes, payment keys (masked), SEO defaults, GA4 and
  Meta Pixel IDs, staff and roles; audit log (django-simple-history).
- **Wagtail:** homepage StreamField blocks Hero3D, Wardrobe3D, CollectionGrid,
  ProductCarousel, StoryBlock, LuxeSpotlight, Lookbook, Reviews, UGC grid, TrustStrip,
  Newsletter — editable, reorderable, toggleable; pages, journal, lookbooks, media.

### 2.11 Backend systems

- Apps: `accounts`, `catalog`, `inventory`, `cart`, `orders`, `payments`, `shipping`,
  `promotions`, `reviews`, `returns`, `content`, `notifications`, `analytics`, `core`.
- Models: User, Address, Product, Variant, Collection, Category, ProductMedia, Cart,
  CartItem, Order, OrderItem, Payment, Shipment, ReturnRequest, Coupon, GiftCard, Review,
  WishlistItem, Subscriber, BackInStockRequest, SiteSettings, plus Wagtail pages.
- REST API under `/api/v1/`: catalogue, collections, content, cart (guest + user, merge
  on login), checkout, payments (create, verify, webhook), orders, account, wishlist,
  reviews, returns, pincode check, newsletter, contact.
- Stock: reserve at checkout inside `select_for_update` transactions, release through
  Celery on timeout or failure, never oversell.
- Money: `Decimal` everywhere, server-calculated totals, GST per line with HSN codes.
- Security: CORS locked to the frontend, CSRF on cookie auth, throttling on auth /
  checkout / forms, webhook signature verification, secure cookies, secrets from env.
- Emails (Celery): welcome, order confirmation, shipped, delivered, return updates,
  abandoned cart, back in stock, password reset.

### 2.12 SEO, analytics, marketing

Next.js metadata from backend SEO fields, OG images, canonicals, `sitemap.xml` from the
API, `robots.txt`; JSON-LD for Organization, Product, BreadcrumbList, FAQPage, Article;
GA4 e-commerce events and Meta Pixel events (ViewContent, AddToCart, InitiateCheckout,
Purchase) with a server-side Conversions API hook; clean slugs
(`/collections/haya-luxe`, `/products/champagne-silk-hijab`).

### 2.13 Quality bar

Mobile-first; Lighthouse Performance ≥ 90 on non-3D pages, Accessibility ≥ 95, SEO 100;
WCAG 2.1 AA including keyboard control of both 3D sections (arrow keys move the
carousel/rail, Enter opens a product); skeleton loaders, optimistic cart, toasts, empty
states, branded 404/500, error boundaries; strict TypeScript, ESLint/Prettier, Ruff;
tests for checkout, payments and stock.

### 2.14 Seed data — `python manage.py seed_demo`

4 collections and ~24 products with 2–4 colour variants each, brand-voice names and
descriptions, INR prices ₹499–₹4,999, stock levels; 8 Top Picks and ~12 In Wardrobe
(hanging abayas, draped and folded hijabs); styled placeholder images on Ivory Cream /
Blush Sand; **every seeded product gets a transparent cut-out fabric texture and a
fabric type so both 3D sections render fully on first run**; sample reviews, FAQs, 3
journal posts, coupons `WELCOME10` and `FREESHIP`, a superuser, and a built Wagtail
homepage.

### 2.15 Build order

1. Monorepo, Django project, apps, models, migrations, Unfold admin, Wagtail, seed
2. DRF API + OpenAPI schema → typed frontend client
3. Next.js shell: tokens, fonts, header/footer, logo, mini-cart
4. Home with 3D Top Picks and 3D Haya Wardrobe (plus 2D fallbacks)
5. Collection and product pages, search, filters
6. Cart, checkout, Razorpay + COD, webhooks, Celery emails
7. Accounts, orders, returns, wishlist
8. Admin dashboard, order workflow, inventory, coupons, reviews, Shiprocket
9. Content/legal pages, SEO, analytics
10. Performance, accessibility and test pass

Deliverables: source for both apps, `README.md`, `.env.example` for each app, the seed
command, OpenAPI docs, a short admin user guide.

---

## 3. Architecture and repo layout

```
Haya-Haze/
├─ CONTEXT.md              this file
├─ README.md               setup, env, deploy, integrations
├─ docker-compose.yml      postgres, redis, backend, celery, celery-beat, frontend
├─ docs/ADMIN_GUIDE.md     day-to-day guide for the store team
├─ .github/workflows/ci.yml
├─ backend/                Django API + admin + CMS
│  ├─ config/              settings, urls, celery, asgi/wsgi
│  ├─ apps/
│  │  ├─ core/             SiteSettings, announcements, contact inbox, shared bases
│  │  ├─ accounts/         User (email login), Address, email OTP, auth endpoints
│  │  ├─ catalog/          Category, Collection, Product, Variant, ProductMedia, Wishlist
│  │  ├─ inventory/        stock services, movements, reservations, back-in-stock
│  │  ├─ cart/             Cart, CartItem, pricing engine (totals, GST, shipping)
│  │  ├─ promotions/       Coupon, GiftCard, Subscriber
│  │  ├─ orders/           Order, OrderItem, OrderEvent, checkout service, invoices
│  │  ├─ payments/         Payment, Refund, providers (razorpay, stripe, cod)
│  │  ├─ shipping/         Shipment, ServiceablePincode, providers (shiprocket, manual)
│  │  ├─ reviews/          Review + moderation
│  │  ├─ returns/          ReturnRequest, items, photos
│  │  ├─ content/          Wagtail page models, StreamField blocks, content API
│  │  ├─ notifications/    email rendering, Celery tasks, WhatsApp hook
│  │  └─ analytics/        dashboard KPIs, admin dashboard, conversions hook
│  ├─ templates/           admin dashboard, emails, invoice
│  └─ tests/
└─ frontend/               Next.js storefront
   ├─ public/brand/        logo assets (swap here)
   └─ src/
      ├─ app/              routes (App Router)
      ├─ components/       brand, layout, ui, product, cart, home, three, account
      ├─ lib/              api client (generated types), utils, analytics
      └─ stores/           Zustand stores (ui, wishlist, recently viewed)
```

Request flow

- The browser only talks to the Next.js origin. `next.config.ts` rewrites `/api/*` and
  `/media/*` to Django, so auth and cart cookies are first-party and no CORS preflight is
  needed in the browser. Server components call Django directly with `API_INTERNAL_URL`.
- Auth: JWT access + refresh in HTTP-only cookies (dj-rest-auth). Guest carts: an
  HTTP-only `hh_cart` cookie holding the cart token; merged into the user cart on login.
- Checkout: `POST /checkout/place/` with an idempotency key → prices recomputed, stock
  reserved under row locks, order created `pending` → provider payload returned →
  Razorpay Checkout → `POST /payments/razorpay/verify/` (signature) and the webhook both
  converge on one idempotent `mark_paid`. COD orders confirm immediately (subject to COD
  rules). Unpaid reservations are released by a Celery beat task.

---

## 4. Decisions and deviations from the spec

Recorded so nobody has to rediscover them.

1. **Local mode without Docker.** With no `DATABASE_URL` the backend uses SQLite, the
   local-memory cache, eager Celery and the console email backend, so `manage.py
   runserver` works with nothing else installed. Search uses Postgres full-text +
   trigram when on Postgres and a plain `icontains` fallback on SQLite.
2. **Python 3.11 compatible.** Docker images use 3.12; the code avoids 3.12-only syntax.
3. **rembg is optional.** It pulls in onnxruntime (large). `requirements/ml.txt` installs
   it; without it the cut-out task uses a built-in border-colour key that works on the
   plain Ivory Cream / Blush Sand backgrounds the brand guide prescribes.
4. **WeasyPrint is optional.** It needs GTK on Windows. It is installed in Docker; when it
   is missing, invoices are served as print-ready HTML instead of PDF.
5. **Payment keys live in environment variables,** not the database. The admin shows
   masked status only.
6. **Sandbox payments.** With no Razorpay keys and `DEBUG=True`, Razorpay checkout runs
   against a clearly labelled sandbox provider so the whole flow can be exercised. It is
   disabled when `DEBUG=False`.
7. **Animation libraries.** Framer Motion + Lenis cover the motion; GSAP was left out to
   keep the bundle small. Bloom is done with additive glow sprites, not a postprocessing
   pass, to protect mobile frame rate.
8. **Fly-to-cart** is a DOM animation layered above the canvas, shared by the 3D and 2D
   versions.
9. **Collection-card ripple** uses an SVG displacement filter, because a WebGL canvas per
   card would break the one-context rule.
10. **Tabby/Tamara, Delhivery/BlueDart/DTDC** are not implemented; the provider
    interfaces are where they plug in.

---

## 5. Build walkthrough and status

Update this list as work lands.

- [ ] 1. Backend foundation: project, apps, models, migrations, admin, Wagtail, seed
- [ ] 2. REST API + OpenAPI schema + generated frontend types
- [ ] 3. Frontend shell: tokens, fonts, logo, header, footer, mini-cart
- [ ] 4. Home: 3D Top Picks, 3D Wardrobe, 2D fallbacks, remaining sections
- [ ] 5. Collection, product, search
- [ ] 6. Cart, checkout, payments, emails
- [ ] 7. Account, orders, returns, wishlist
- [ ] 8. Admin dashboard and workflows
- [ ] 9. Content and legal pages, SEO, analytics
- [ ] 10. Tests, performance and accessibility pass

---

## 6. Reference notes (systems, not UI)

From https://ovaisabayacollection.in/ (a Shopify store; only the homepage could be read,
later requests were rate-limited):

- Header with search, wishlist, account and cart count; nav entries for New Arrivals,
  All Products, Collections dropdown, Track Order, Reviews, Blogs, About, FAQs and an
  "Easy Exchange" self-service returns flow.
- Product cards carry a "% OFF" badge, review count, sale price and struck-through
  compare-at price in INR.
- Drawer cart with an order-note field; cookie consent banner; campaign banners linking
  to spend-based offer collections.

Patterns adopted here: track-order page, self-service returns/exchange, wishlist, drawer
cart with order note, % off badges with review counts, cookie consent, offer collections
(rule-based collections plus auto-apply coupons).
