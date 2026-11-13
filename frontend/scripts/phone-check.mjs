// Dev helper: checks every page type at phone widths. Fails a page if the phone has to
// zoom out (layout wider than the screen), the cart icon is clipped, or a script errors.
//   node scripts/phone-check.mjs <base-url> [screenshot-dir]
import { chromium } from "playwright-core";

const [base, shots] = process.argv.slice(2);
const PATHS = [
  "/", "/collections/all", "/collections/covered-edit", "/products/midnight-crepe-abaya", "/products/champagne-silk-hijab",
  "/search?q=silk", "/cart", "/checkout", "/wishlist", "/track-order", "/account/login", "/account/register",
  "/about", "/faq", "/lookbook", "/journal", "/journal/the-meaning-of-haya", "/size-guide", "/shipping-policy", "/contact", "/nope",
];
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await context.addInitScript(() => {
  localStorage.setItem("hh-cookie-consent", "declined");
  localStorage.setItem("hh-welcome-popup", String(Date.now()));
});
// Fill the bag once so the cart and checkout show their full layouts.
const setup = await context.newPage();
await setup.goto(base + "/", { waitUntil: "networkidle" });
await setup.evaluate(async () => {
  await fetch("/api/v1/auth/csrf/", { credentials: "include" });
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
  for (const slug of ["rosewater-chiffon-scarf", "midnight-crepe-abaya"]) {
    const p = await (await fetch(`/api/v1/products/${slug}/`)).json();
    const v = p.variants.find((x) => x.available > 0);
    await fetch("/api/v1/cart/items/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf }, body: JSON.stringify({ variant_id: v.id, quantity: 1 }) });
  }
});
await setup.close();

let failures = 0;
for (const width of [360, 390]) {
  for (const path of PATHS) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: 780 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
    await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate((w) => {
      const cart = document.getElementById("cart-icon")?.getBoundingClientRect();
      const wide = [...document.querySelectorAll("main *, header *")].filter((e) => e.getBoundingClientRect().right > w + 1
        && !e.closest(".overflow-hidden, .overflow-x-auto, .no-scrollbar, [aria-roledescription], canvas") && getComputedStyle(e).position !== "fixed");
      const inner = wide.filter((e) => !wide.some((o) => o !== e && e.contains(o))).slice(0, 2);
      return { layout: document.documentElement.scrollWidth, cart: cart ? Math.round(cart.right) : 0,
               wide: inner.map((e) => `${e.tagName}"${(e.textContent || "").trim().slice(0, 24)}"`) };
    }, width);
    const ok = r.layout <= width && r.cart <= width && !errors.length;
    failures += !ok;
    if (shots && width === 360) await page.screenshot({ path: `${shots}/phone360${path.replace(/[/?=]/g, "_") || "_home"}.png`, fullPage: false });
    console.log(`${ok ? "OK  " : "FIX "} ${width}px ${path.padEnd(34)} layout ${r.layout}px${r.wide.length ? "  too wide: " + r.wide.join(", ") : ""}${errors.length ? "  errors: " + errors.join(" | ") : ""}`);
    await page.close();
  }
}
console.log(failures ? `${failures} page view(s) need fixing` : "All pages fit phone screens.");
await browser.close();
