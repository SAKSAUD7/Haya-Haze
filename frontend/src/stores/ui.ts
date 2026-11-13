"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Product } from "@/lib/types";

type Flight = { id: number; src: string; from: { x: number; y: number; w: number; h: number } };

type UIState = {
  cartOpen: boolean;
  menuOpen: boolean;
  searchOpen: boolean;
  /** Product shown in the quick view. `side` docks it beside the 3D wardrobe. */
  quickView: { product: Product; mode: "center" | "side"; color?: string } | null;
  flights: Flight[];
  cartPulse: number;
  openCart: () => void;
  closeCart: () => void;
  setMenu: (open: boolean) => void;
  setSearch: (open: boolean) => void;
  openQuickView: (product: Product, mode?: "center" | "side", color?: string) => void;
  closeQuickView: () => void;
  /** Send a product image flying to the cart icon, then open the mini-cart. */
  flyToCart: (src: string, from: DOMRect | null) => void;
  endFlight: (id: number) => void;
};

let flightId = 0;

export const useUI = create<UIState>((set) => ({
  cartOpen: false,
  menuOpen: false,
  searchOpen: false,
  quickView: null,
  flights: [],
  cartPulse: 0,
  openCart: () => set({ cartOpen: true, menuOpen: false, searchOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  setMenu: (menuOpen) => set({ menuOpen }),
  setSearch: (searchOpen) => set({ searchOpen }),
  openQuickView: (product, mode = "center", color) => set({ quickView: { product, mode, color } }),
  closeQuickView: () => set({ quickView: null }),
  flyToCart: (src, rect) => {
    const from = rect
      ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
      : { x: window.innerWidth / 2 - 60, y: window.innerHeight / 2 - 80, w: 120, h: 160 };
    set((s) => ({ flights: [...s.flights, { id: ++flightId, src, from }] }));
  },
  endFlight: (id) =>
    set((s) => ({ flights: s.flights.filter((f) => f.id !== id), cartPulse: s.cartPulse + 1, cartOpen: true })),
}));

// --- Wishlist: kept in the browser for guests, synced to the account when signed in ---
type WishlistState = {
  ids: number[];
  toggle: (id: number) => boolean;
  set: (ids: number[]) => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const has = get().ids.includes(id);
        set({ ids: has ? get().ids.filter((x) => x !== id) : [...get().ids, id] });
        return !has;
      },
      set: (ids) => set({ ids }),
    }),
    { name: "hh-wishlist" },
  ),
);

// --- Recently viewed products ---------------------------------------------------------
type RecentState = { slugs: string[]; push: (slug: string) => void };

export const useRecent = create<RecentState>()(
  persist(
    (set, get) => ({
      slugs: [],
      push: (slug) => set({ slugs: [slug, ...get().slugs.filter((s) => s !== slug)].slice(0, 10) }),
    }),
    { name: "hh-recent" },
  ),
);

// --- Only one WebGL canvas may be alive at a time ------------------------------------
type CanvasArbiter = {
  ratios: Record<string, number>;
  active: string | null;
  report: (id: string, ratio: number) => void;
};

export const useCanvasArbiter = create<CanvasArbiter>((set, get) => ({
  ratios: {},
  active: null,
  report: (id, ratio) => {
    const ratios = { ...get().ratios, [id]: ratio };
    if (ratio <= 0) delete ratios[id];
    let active: string | null = null;
    let best = 0.02;
    // Keep the current canvas unless another section is clearly more visible (avoids flapping).
    const current = get().active;
    for (const [key, value] of Object.entries(ratios)) {
      const weighted = key === current ? value + 0.15 : value;
      if (weighted > best) {
        best = weighted;
        active = key;
      }
    }
    set({ ratios, active });
  },
}));
