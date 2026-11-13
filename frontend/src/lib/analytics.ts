"use client";

/**
 * GA4 e-commerce events and Meta Pixel events from one call site.
 * Nothing is sent until the shopper accepts cookies and an ID is set in Store settings.
 */
import type { Order, Product, Variant } from "./types";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export const CONSENT_KEY = "hh-cookie-consent";

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

type Item = { product: Pick<Product, "id" | "name" | "price" | "collection">; variant?: Pick<Variant, "sku" | "label" | "price">; quantity?: number };

function gaItem({ product, variant, quantity = 1 }: Item) {
  return {
    item_id: variant?.sku ?? String(product.id),
    item_name: product.name,
    item_category: product.collection?.name,
    item_variant: variant?.label,
    price: Number(variant?.price ?? product.price),
    quantity,
  };
}

type Events = {
  view_item: Item;
  add_to_cart: Item;
  begin_checkout: { value: number; count: number };
  purchase: { order: Order };
  search: { term: string };
};

const META_NAMES: Record<keyof Events, string> = {
  view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase",
  search: "Search",
};

export function track<K extends keyof Events>(event: K, data: Events[K]): void {
  if (typeof window === "undefined" || !hasConsent()) return;
  let ga: Record<string, unknown> = {};
  let meta: Record<string, unknown> = {};
  let metaOptions: Record<string, unknown> | undefined;

  if (event === "view_item" || event === "add_to_cart") {
    const item = gaItem(data as Item);
    ga = { currency: "INR", value: item.price * item.quantity, items: [item] };
    meta = { currency: "INR", value: item.price * item.quantity, content_ids: [item.item_id], content_name: item.item_name, content_type: "product" };
  } else if (event === "begin_checkout") {
    const d = data as Events["begin_checkout"];
    ga = { currency: "INR", value: d.value };
    meta = { currency: "INR", value: d.value, num_items: d.count };
  } else if (event === "purchase") {
    const { order } = data as Events["purchase"];
    const value = Number(order.grand_total);
    ga = {
      transaction_id: order.number, currency: "INR", value, shipping: Number(order.shipping_total),
      tax: Number(order.tax_total), coupon: order.coupon_code || undefined,
      items: order.items.map((i) => ({ item_id: i.sku, item_name: i.product_name, item_variant: i.variant_label, price: Number(i.unit_price), quantity: i.quantity })),
    };
    meta = { currency: "INR", value, content_ids: order.items.map((i) => i.sku), content_type: "product" };
    // Same id as the server-side Conversions API event, so Meta de-duplicates.
    metaOptions = { eventID: order.number };
  } else if (event === "search") {
    ga = { search_term: (data as Events["search"]).term };
    meta = { search_string: (data as Events["search"]).term };
  }

  window.gtag?.("event", event, ga);
  if (metaOptions) window.fbq?.("track", META_NAMES[event], meta, metaOptions);
  else window.fbq?.("track", META_NAMES[event], meta);
}
