"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { useUI, useWishlist } from "@/stores/ui";

import { track } from "./analytics";
import { api, ApiError, errorMessage } from "./api/client";
import type { Cart, Product, SiteConfig, User, Variant, WishlistItem } from "./types";

// --- Environment ---------------------------------------------------------------------
function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  };
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(subscribeMedia(query), () => window.matchMedia(query).matches, () => serverValue);
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

// --- Site config -----------------------------------------------------------------------
export function useSite() {
  return useQuery({ queryKey: ["site"], queryFn: () => api<SiteConfig>("/site/"), staleTime: 5 * 60_000 }).data;
}

// --- Session -----------------------------------------------------------------------------
export function useUser() {
  const query = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        return await api<User>("/auth/user/");
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
  return { user: query.data ?? null, loading: query.isLoading };
}

/** Call after any successful sign-in: refreshes session-bound data and merges the guest wishlist. */
export function useAfterLogin() {
  const client = useQueryClient();
  return async (user: User) => {
    client.setQueryData(["user"], user);
    const local = useWishlist.getState().ids;
    try {
      const items = await api<WishlistItem[]>("/wishlist/", { method: "PUT", body: { product_ids: local } });
      useWishlist.getState().set(items.map((i) => i.product.id));
    } catch {
      /* wishlist sync is best-effort */
    }
    await client.invalidateQueries({ queryKey: ["cart"] });
  };
}

export function useLogout() {
  const client = useQueryClient();
  return async () => {
    await api("/auth/logout/", { method: "POST" }).catch(() => undefined);
    client.setQueryData(["user"], null);
    client.removeQueries({ queryKey: ["orders"] });
    await client.invalidateQueries({ queryKey: ["cart"] });
  };
}

// --- Cart ----------------------------------------------------------------------------------
export function useCart() {
  return useQuery({ queryKey: ["cart"], queryFn: () => api<Cart>("/cart/"), staleTime: 30_000 });
}

export function useCartActions() {
  const client = useQueryClient();
  const apply = (cart: Cart) => {
    client.setQueryData(["cart"], cart);
    // Checkout quotes are derived from the cart; refetch them.
    client.invalidateQueries({ queryKey: ["cart", "quote"] });
    if (cart.issues[0]?.startsWith("Only")) toast.message(cart.issues[0]);
  };
  const run = async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    const cart = await api<Cart>(path, { method, body });
    apply(cart);
    return cart;
  };

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: number; quantity?: number; saved_for_later?: boolean; variant_id?: number }) =>
      run(`/cart/items/${id}/`, "PATCH", body),
    // Optimistic: the bag reacts instantly; the server response then corrects the totals.
    onMutate: async ({ id, quantity }) => {
      await client.cancelQueries({ queryKey: ["cart"], exact: true });
      const previous = client.getQueryData<Cart>(["cart"]);
      if (previous && quantity !== undefined) {
        const items = previous.items
          .map((i) => (i.id === id ? { ...i, quantity, line_total: (Number(i.unit_price) * quantity).toFixed(2) } : i))
          .filter((i) => i.quantity > 0);
        client.setQueryData<Cart>(["cart"], {
          ...previous, items, item_count: items.reduce((n, i) => n + i.quantity, 0),
        });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) client.setQueryData(["cart"], context.previous);
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => run(`/cart/items/${id}/`, "DELETE"),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["cart"], exact: true });
      const previous = client.getQueryData<Cart>(["cart"]);
      if (previous) {
        const items = previous.items.filter((i) => i.id !== id);
        client.setQueryData<Cart>(["cart"], {
          ...previous, items, saved: previous.saved.filter((i) => i.id !== id),
          item_count: items.reduce((n, i) => n + i.quantity, 0),
        });
      }
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) client.setQueryData(["cart"], context.previous);
      toast.error(errorMessage(error));
    },
  });

  return {
    add: (variantId: number, quantity = 1) => run("/cart/items/", "POST", { variant_id: variantId, quantity }),
    update,
    remove,
    patch: (body: { gift_wrap?: boolean; gift_note?: string; order_note?: string; email?: string }) => run("/cart/", "PATCH", body),
    applyCoupon: (code: string) => run("/cart/coupon/", "POST", { code }),
    removeCoupon: () => run("/cart/coupon/", "DELETE"),
    applyGiftCard: (code: string) => run("/cart/gift-card/", "POST", { code }),
    removeGiftCard: () => run("/cart/gift-card/", "DELETE"),
  };
}

/** Add to bag with the fly-to-cart animation. Returns true on success. */
export function useAddToCart() {
  const { add } = useCartActions();
  const [pending, setPending] = useState(false);
  const addToCart = async (
    product: Product, variant: Variant | undefined, opts: { quantity?: number; from?: Element | null; image?: string; silent?: boolean } = {},
  ): Promise<boolean> => {
    if (!variant) {
      toast.error("Please choose an option first.");
      return false;
    }
    setPending(true);
    try {
      await add(variant.id, opts.quantity ?? 1);
      track("add_to_cart", { product, variant, quantity: opts.quantity ?? 1 });
      if (!opts.silent) {
        const image = opts.image ?? product.media.find((m) => m.image)?.image ?? "";
        useUI.getState().closeQuickView();
        useUI.getState().flyToCart(image, opts.from?.getBoundingClientRect() ?? null);
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setPending(false);
    }
  };
  return { addToCart, pending };
}

// --- Wishlist ----------------------------------------------------------------------------
export function useWishlistToggle() {
  const { user } = useUser();
  const ids = useWishlist((s) => s.ids);
  const toggle = (product: Pick<Product, "id" | "name">) => {
    const added = useWishlist.getState().toggle(product.id);
    toast.success(added ? `${product.name} saved to your wishlist` : "Removed from your wishlist");
    if (user) {
      const request = added
        ? api("/wishlist/", { method: "POST", body: { product_id: product.id } })
        : api(`/wishlist/${product.id}/`, { method: "DELETE" });
      request.catch(() => undefined);
    }
    return added;
  };
  return { ids, toggle };
}
