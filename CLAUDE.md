# Haya & Haze

Read `CONTEXT.md` first: brand guide, full build spec, architecture, decisions and status.

- `backend/` Django API + Unfold admin + Wagtail CMS. `frontend/` Next.js storefront.
- Backend: `cd backend && .venv/Scripts/python manage.py runserver 8000`; tests `.venv/Scripts/python -m pytest tests`; lint `ruff check .`
- Frontend: `cd frontend && npm run dev`; `npm run typecheck`. Dev compiles are slow in this OneDrive folder; `npm run build && npm start` is faster for checking pages.
- After changing serializers: `python manage.py spectacular --file ../frontend/openapi.yaml` then `npm run api:types`. Frontend API types come only from that generated schema (`src/lib/types.ts`).
- Money and stock rules live in `apps/cart/pricing.py`, `apps/orders/services.py`, `apps/inventory/services.py`. Never compute totals or change stock anywhere else.
- All 3D goes through `src/components/three/FabricMesh.tsx`; every 3D section must keep a working 2D poster in its `CanvasGate`.
- Copy: warm, elegant, never preachy or salesy. Camel buttons take Deep Mocha text (white on camel fails contrast).
