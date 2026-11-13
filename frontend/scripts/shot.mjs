// Dev helper: screenshot a page with the installed Edge/Chrome (no browser download).
//   node scripts/shot.mjs <url> <out.png> [width] [height] [scrollY|selector] [waitMs] [fullPage]
import { chromium } from "playwright-core";

const [url, out, width = "1440", height = "900", scroll = "0", wait = "3500", full = ""] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: process.env.SHOT_CHANNEL || "msedge",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 400)));
await page.addInitScript(() => {
  try {
    localStorage.setItem("hh-cookie-consent", "declined");
    localStorage.setItem("hh-welcome-popup", String(Date.now()));
  } catch {}
});
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => errors.push("GOTO " + e.message));
if (/^\d+$/.test(scroll)) {
  if (+scroll > 0) await page.evaluate((y) => window.scrollTo(0, y), +scroll);
} else {
  await page.locator(scroll).first().scrollIntoViewIfNeeded().catch((e) => errors.push("SCROLL " + e.message));
}
if (process.env.SHOT_WAIT3D) {
  // Wait for the n-th 3D section to take over from its poster (dev compiles can be slow).
  await page.waitForFunction((i) => document.querySelectorAll("[data-three]")[i]?.dataset.three === "on", +process.env.SHOT_WAIT3D, { timeout: 180000 }).catch(() => errors.push("3D did not start"));
}
await page.waitForTimeout(+wait);
if (process.env.SHOT_EVAL) console.log("EVAL", JSON.stringify(await page.evaluate(process.env.SHOT_EVAL)));
await page.screenshot({ path: out, fullPage: full === "full" });
console.log("three:", await page.evaluate(() => [...document.querySelectorAll("[data-three]")].map((e) => e.dataset.three).join(",")));
if (errors.length) console.log("ERRORS\n" + [...new Set(errors)].slice(0, 12).join("\n"));
await browser.close();
