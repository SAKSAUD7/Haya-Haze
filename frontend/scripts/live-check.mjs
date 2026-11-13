// Dev helper: screenshots of a deployed storefront at desktop and phone sizes.
//   node scripts/live-check.mjs <base-url> <out-dir>
import { chromium } from "playwright-core";

const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const PAGES = [
  ["home", "/", { three: 0 }],
  ["wardrobe", "/", { scroll: '[aria-roledescription="wardrobe rail"]', three: 1 }],
  ["collection", "/collections/all", {}],
  ["product", "/products/midnight-crepe-abaya", {}],
  ["checkout", "/checkout", {}],
];
for (const [label, w, h, mobile] of [["desktop", 1440, 900, false], ["phone", 390, 844, true]]) {
  for (const [name, path, opts] of PAGES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push("JS: " + String(e).slice(0, 200)));
    page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`));
    await page.addInitScript(() => {
      localStorage.setItem("hh-cookie-consent", "declined");
      localStorage.setItem("hh-welcome-popup", String(Date.now()));
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 120000 }).catch(() => null);
      if (res && res.ok()) break;
      await page.waitForTimeout(10000);
    }
    if (name === "checkout") {
      // Put something in the bag so checkout shows the form, not the empty state.
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.evaluate(async () => {
        await fetch("/api/v1/auth/csrf/", { credentials: "include" });
        const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
        const p = await (await fetch("/api/v1/products/rosewater-chiffon-scarf/")).json();
        const v = p.variants.find((x) => x.available > 0);
        await fetch("/api/v1/cart/items/", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf }, body: JSON.stringify({ variant_id: v.id, quantity: 1 }) });
      });
      await page.reload({ waitUntil: "networkidle" });
    }
    if (opts.scroll) await page.locator(opts.scroll).first().scrollIntoViewIfNeeded().catch(() => errors.push("scroll failed"));
    if (opts.three !== undefined && !mobile) {
      await page.waitForFunction((i) => document.querySelectorAll("[data-three]")[i]?.dataset.three === "on", opts.three, { timeout: 90000 }).catch(() => errors.push("3D did not start"));
    }
    await page.waitForTimeout(3500);
    await page.waitForLoadState("networkidle").catch(() => {});  // Next.js may reload once after a deploy
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `${out}/live-${label}-${name}.png` });
    console.log(`${label.padEnd(7)} ${name.padEnd(10)} 3D=${await page.evaluate(() => [...document.querySelectorAll("[data-three]")].map((e) => e.dataset.three).join(",") || "-")} sideways-scroll=${overflow > 1 ? overflow + "px" : "none"} ${errors.join(" | ") || "ok"}`);
    await page.close();
  }
}
await browser.close();
