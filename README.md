# Haya & Haze

E-commerce platform for Haya & Haze, a modest-fashion brand (hijabs and modest wear).
One repository, two apps:

| Folder | What it is | Runs on |
|---|---|---|
| `frontend/` | Next.js 15 storefront (App Router, TypeScript, Tailwind, React Three Fiber) | http://localhost:3000 |
| `backend/` | Django 5 API, admin portal (Unfold) and CMS (Wagtail) | http://localhost:8000 |

`CONTEXT.md` holds the brand guide, the full build specification, the architecture
decisions and the build status. Read it before changing anything substantial.
`docs/ADMIN_GUIDE.md` is the day-to-day guide for the store team.

## Run it locally

You need Python 3.11+ and Node 20+. Nothing else: with no configuration the backend
uses SQLite, runs background tasks inline and prints emails to the terminal.

**1. Backend** (first terminal)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py seed_demo        # demo catalogue, CMS pages, coupons, sample orders
python manage.py runserver 8000
```

**2. Storefront** (second terminal)

```bash
cd frontend
npm install
copy .env.example .env.local      # macOS/Linux: cp .env.example .env.local
npm run dev
```

Then open:

| | URL | Login |
|---|---|---|
| Storefront | http://localhost:3000 | — |
| Admin portal | http://localhost:8000/admin/ | `admin@hayaandhaze.com` / `HayaHaze@2025` |
| CMS | http://localhost:8000/cms/ | same |
| API docs | http://localhost:8000/api/docs/ | — |

The admin password comes from `DJANGO_SUPERUSER_PASSWORD` when `seed_demo` first runs.
**Change it before the site is reachable from the internet.**

The first page load in `npm run dev` compiles on demand and can take a while. For a
fast local run use `npm run build && npm start`.

### With Docker instead

```bash
docker compose up --build
docker compose exec backend python manage.py seed_demo
```

This runs the production-shaped stack: Postgres, Redis, the API, a Celery worker,
Celery beat and the storefront.

## How the pieces fit

- The browser only talks to the storefront. `next.config.ts` proxies `/api/*` and
  `/media/*` to Django, so login and cart cookies are first-party.
- Sign-in uses JWTs in HTTP-only cookies. Guests get a cart cookie; the guest cart is
  merged into the account at login.
- Prices, stock, coupons, shipping and GST are always calculated on the server
  (`backend/apps/cart/pricing.py`). The browser never sends an amount.
- Stock is reserved under row locks when an order is placed, committed when it is paid
  (or confirmed, for COD) and released if payment fails or times out
  (`backend/apps/inventory/services.py`).
- All 3D uses one component, `frontend/src/components/three/FabricMesh.tsx`: a product
  photo rendered as cloth. Each 3D section has a complete 2D version that is shown
  while 3D loads and whenever 3D is unavailable.

## Common tasks

| Task | Command |
|---|---|
| Backend tests | `cd backend && pytest tests` |
| Backend lint | `cd backend && ruff check .` |
| Storefront type-check | `cd frontend && npm run typecheck` |
| Regenerate API types after changing serializers | `cd backend && python manage.py spectacular --file ../frontend/openapi.yaml` then `cd frontend && npm run api:types` |
| Rebuild logo files | `cd frontend && npm run brand:logo` |
| Re-seed demo data (safe to repeat) | `cd backend && python manage.py seed_demo` |

## Configuration

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env.local`. Every variable is described in those files. The ones that matter
for going live:

### Payments: Razorpay

1. Razorpay Dashboard → Account & Settings → API Keys. Put the key id and secret in
   `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Dashboard → Webhooks → add `https://<api-domain>/api/v1/payments/razorpay/webhook/`
   with events `payment.captured` and `order.paid`. Put its secret in
   `RAZORPAY_WEBHOOK_SECRET`.

With no keys and `DEBUG=True`, checkout shows a clearly labelled sandbox payment
screen so the flow can be tested end to end. Sandbox is refused when `DEBUG=False`.

Cash on Delivery needs no setup; its fee and order limits are in Store settings.
Stripe (international cards) switches on when `STRIPE_SECRET_KEY` is set; its webhook is
`/api/v1/payments/stripe/webhook/`.

### Shipping: Shiprocket

Create an API user in Shiprocket (Settings → API → Configure) and set
`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` and `SHIPROCKET_PICKUP_LOCATION`. For live
tracking updates, add the webhook `https://<api-domain>/api/v1/shipping/webhook/shiprocket/`
in Shiprocket and set the same secret there (as `x-api-key`) and in
`SHIPROCKET_WEBHOOK_TOKEN`. Without Shiprocket, staff enter the courier and tracking
number by hand in the admin.

### Email

Set `RESEND_API_KEY`, or the `EMAIL_HOST…` variables for any SMTP provider. With
neither, emails are printed to the terminal. Templates are in `backend/templates/emails/`.

### Media storage (S3 or compatible)

Set `AWS_STORAGE_BUCKET_NAME` and credentials. Allow `GET` from the storefront's origin
in the bucket's CORS settings: the 3D sections load product cut-outs as WebGL textures,
which the browser only permits with CORS headers.

### Better 3D cut-outs (optional)

`pip install -r requirements/ml.txt` adds `rembg`, which removes photo backgrounds
accurately. Without it, a built-in method is used that works on plain backdrops.

### Google sign-in (optional)

Create an OAuth client in Google Cloud Console with redirect URI
`https://<store-domain>/account/google`, then set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`.

## Deploy

**Backend** (Railway, Render, DigitalOcean or any Docker host): build `backend/Dockerfile`.
Provide managed Postgres (`DATABASE_URL`) and Redis (`REDIS_URL`), and set `DEBUG=False`,
a long random `SECRET_KEY`, `ALLOWED_HOSTS`, `FRONTEND_URL` and `BACKEND_URL`. Run two
more processes from the same image: `celery -A config worker -l info` and
`celery -A config beat -l info`. The container runs migrations on start.

**Storefront** (Vercel): set the project root to `frontend/` and the environment
variables `API_INTERNAL_URL` (the backend's URL) and `NEXT_PUBLIC_SITE_URL` (the public
store URL).

Before launch: change the admin password, replace the demo catalogue and imagery, have
the legal pages reviewed, fill in the GSTIN and address in Store settings, and place one
real order with each payment method.

## Not included yet

Tabby/Tamara (buy now, pay later), couriers other than Shiprocket, and WhatsApp order
messages have their extension points in place (`payments/providers`,
`shipping/providers`, `notifications/service.py`) but are not connected to a provider.
