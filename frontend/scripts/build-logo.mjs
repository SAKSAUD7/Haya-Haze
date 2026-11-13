/**
 * Builds the Haya & Haze logo files.   npm run brand:logo
 *
 * Letters are converted to outlines (Cormorant Garamond Medium) so the files render
 * identically everywhere, with no font needed. Writes:
 *   public/brand/*.svg, *.png          static assets (favicon, lockups, social image)
 *   src/components/brand/logo-paths.ts the same outlines for the React <Logo /> component
 *
 * To change the figure, edit FIGURE below. To replace the logo with final artwork, drop
 * new files into public/brand and update src/components/brand/Logo.tsx.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import opentype from "opentype.js";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "brand");
fs.mkdirSync(out, { recursive: true });

const fontFile = path.join(root, "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff");
const buffer = fs.readFileSync(fontFile);
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const glyphs = (text, x, y, size, spacing = 0) => font.getPath(text, x, y, size, { letterSpacing: spacing }).toPathData(2);
const width = (text, size, spacing = 0) => font.getAdvanceWidth(text, size, { letterSpacing: spacing });

// --- Monogram geometry (viewBox 0 0 240 250) ------------------------------------------
const VIEW = "0 0 240 250";
const H1 = glyphs("h", 14, 190, 236);    // tall, dark "h"
const H2 = glyphs("h", 132, 242, 172);   // smaller camel "h", set lower

/**
 * The figure, seen from behind: a head covered by a hijab, and a long drape that falls
 * from the shoulders, sweeps down between the letters and curls away to the lower left.
 */
const FIGURE = {
  // cloak: from the shoulders it widens and sweeps away to a tail at the lower left
  drape:
    "M113 87 C 103 92, 95 101, 91 115 C 85 141, 84 167, 70 193 C 60 211, 40 222, 37 236 " +
    "C 35 247, 60 247, 84 241 C 108 235, 130 240, 148 245 L 151 124 C 158 118, 161 110, 158 102 C 156 95, 153 91, 151 87 Z",
  // head covered by the hijab, seen from behind
  head: "M113 88 C 105 72, 102 48, 113 35 C 122 24, 141 23, 150 34 C 160 46, 157 66, 151 88 C 140 96, 124 96, 113 88 Z",
  folds: [
    "M118 40 C 112 52, 112 68, 116 82",
    "M146 43 C 149 56, 147 70, 143 83",
    "M119 95 C 113 124, 108 160, 86 200",
    "M129 97 C 127 132, 123 178, 105 233",
    "M140 96 C 142 132, 141 182, 131 238",
    "M70 193 C 79 205, 75 223, 58 237",
    "M100 108 C 96 128, 96 150, 90 170",
  ],
};

const TONES = {
  // on light backgrounds
  dark: { primary: "#4A2C2A", accent: "#B08F68", line: "#A58461", fill: "#FBF3EC", caption: "#8A6D4F" },
  // on dark backgrounds
  light: { primary: "#FFF8F6", accent: "#D9BC95", line: "#E3C9A4", fill: "#4A342A", caption: "#D9BC95" },
};

function monogram(tone, x = 0, y = 0, scale = 1) {
  const c = TONES[tone];
  return `<g transform="translate(${x} ${y}) scale(${scale})">
  <path d="${H1}" fill="${c.primary}"/>
  <g stroke="${c.line}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="${FIGURE.drape}" fill="${c.fill}"/>
    <path d="${FIGURE.head}" fill="${c.fill}"/>
    ${FIGURE.folds.map((d, i) => `<path d="${d}"${i > 4 ? ' opacity=".7"' : ""}/>`).join("\n    ")}
  </g>
  <path d="${H2}" fill="${c.accent}"/>
</g>`;
}

const svg = (viewBox, body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Haya &amp; Haze">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ""}\n${body}\n</svg>\n`;

/** Wordmark "haya & haze" as outlines, centred on cx. Returns { body, width }. */
function wordmark(tone, cx, baseline, size) {
  const c = TONES[tone];
  const parts = [["haya ", c.primary], ["& ", c.accent], ["haze", c.primary]];
  const total = parts.reduce((n, [t]) => n + width(t, size), 0);
  let x = cx - total / 2;
  const body = parts.map(([text, fill]) => {
    const d = glyphs(text, x, baseline, size);
    x += width(text, size);
    return `<path d="${d}" fill="${fill}"/>`;
  }).join("\n");
  return { body, width: total };
}

function caption(tone, cx, baseline, size = 15) {
  const c = TONES[tone];
  const text = "HIJAB & ABAYA";
  const spacing = 0.42;
  const w = width(text, size, spacing);
  const y = baseline - size * 0.32;
  return `<path d="${glyphs(text, cx - w / 2, baseline, size, spacing)}" fill="${c.caption}"/>
<path d="M${cx - w / 2 - 62} ${y}h46M${cx + w / 2 + 16} ${y}h46" stroke="${c.caption}" stroke-width="1"/>`;
}

function lockup(tone, bg) {
  // 640 × 640: monogram, wordmark, caption between hairlines (after the client reference)
  return svg("0 0 640 640", [monogram(tone, 185, 60, 1.12), wordmark(tone, 320, 452, 104).body, caption(tone, 320, 520, 17)].join("\n"), bg);
}

function inline(tone) {
  const mark = monogram(tone, 0, 0, 0.4);
  const word = wordmark(tone, 0, 0, 62);
  const body = `${mark}\n<g transform="translate(${112 + word.width / 2} 72)">${word.body}</g>`;
  return svg(`0 0 ${Math.ceil(124 + word.width)} 100`, body);
}

const files = {
  "monogram.svg": svg(VIEW, monogram("dark")),
  "monogram-light.svg": svg(VIEW, monogram("light")),
  "logo-lockup.svg": lockup("dark"),
  "logo-lockup-light.svg": lockup("light"),
  "logo-inline.svg": inline("dark"),
  "logo-inline-light.svg": inline("light"),
  "wordmark.svg": svg("0 0 520 130", wordmark("dark", 260, 92, 110).body),
  "wordmark-light.svg": svg("0 0 520 130", wordmark("light", 260, 92, 110).body),
  // Favicon: the monogram on a soft blush tile
  "favicon.svg": svg("0 0 256 256", `<rect width="256" height="256" rx="56" fill="#F5E6DE"/>\n${monogram("dark", 22, 12, 0.9)}`),
};
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(out, name), content);

const png = (source, file, size, extra = {}) =>
  sharp(Buffer.from(source), { density: 300 }).resize(size.w, size.h, { fit: "contain", background: extra.bg ?? { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(out, file));

// Social sharing image: lockup centred on a blush-to-ivory field with the tagline
const og = svg("0 0 1200 630", `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2D4D0"/><stop offset="1" stop-color="#FFF8F6"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<rect x="28" y="28" width="1144" height="574" rx="26" fill="none" stroke="#C9A84C" stroke-opacity=".55"/>
${monogram("dark", 496, 54, 0.87)}
${wordmark("dark", 600, 392, 112).body}
${caption("dark", 600, 452, 18)}
<path d="${glyphs("Draped in Grace. Defined by You.", 600 - width("Draped in Grace. Defined by You.", 34) / 2, 540, 34)}" fill="#7B4F3A"/>`);
fs.writeFileSync(path.join(out, "og.svg"), og);

await Promise.all([
  png(files["logo-lockup.svg"], "logo-lockup.png", { w: 1280, h: 1280 }),
  png(files["logo-lockup-light.svg"], "logo-lockup-light.png", { w: 1280, h: 1280 }),
  png(lockup("dark", "#F5E6DE"), "logo-lockup-on-blush.png", { w: 1280, h: 1280 }),
  png(lockup("light", "#3D2B1F"), "logo-lockup-on-espresso.png", { w: 1280, h: 1280 }),
  png(files["monogram.svg"], "monogram.png", { w: 768, h: 800 }),
  png(files["favicon.svg"], "apple-touch-icon.png", { w: 180, h: 180 }),
  png(files["favicon.svg"], "icon-512.png", { w: 512, h: 512 }),
  png(og, "og.png", { w: 1200, h: 630 }),
]);

// Outlines for the React component (kept in sync with the static files).
fs.writeFileSync(
  path.join(root, "src/components/brand/logo-paths.ts"),
  `// Generated by scripts/build-logo.mjs. Do not edit by hand: run \`npm run brand:logo\`.
export const MONOGRAM_VIEWBOX = ${JSON.stringify(VIEW)};
export const H1 = ${JSON.stringify(H1)};
export const H2 = ${JSON.stringify(H2)};
export const FIGURE = ${JSON.stringify(FIGURE, null, 2)};
`,
);
console.log("Logo files written to public/brand:", Object.keys(files).length + 9);
