import { clsx, type ClassValue } from "clsx";

import type { Product, Variant } from "./types";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

/** ₹1,499 — paise are shown only when they are not zero. */
export function formatINR(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? inr.format(n) : inrPrecise.format(n);
}

/**
 * Same-origin URL for a media file. Local media arrives as `/media/...` and is proxied by
 * Next.js; files on S3/CDN arrive absolute and pass through untouched.
 */
export function media(path: string | null | undefined): string {
  return path || "/brand/placeholder.svg";
}

export function productImage(product: Pick<Product, "media">, color?: string, index = 0): string {
  const images = product.media.filter((m) => m.image);
  const forColor = color ? images.filter((m) => m.color_name === color) : [];
  const pick = forColor[index] ?? (index === 0 ? forColor[0] : undefined) ?? images[index] ?? images[0];
  return media(pick?.image);
}

/** Second image for the hover crossfade on cards (a different shot, when there is one). */
export function hoverImage(product: Pick<Product, "media">): string | null {
  const images = product.media.filter((m) => m.image);
  const detail = images.find((m) => !m.color_name) ?? images[1];
  return detail && detail !== images[0] ? media(detail.image) : null;
}

export function firstAvailable(variants: Variant[]): Variant | undefined {
  return variants.find((v) => v.available > 0) ?? variants[0];
}

export function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  // A fixed time zone: the server (UTC on most hosts) and the browser must print the same
  // date, or React reports a hydration mismatch.
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}
