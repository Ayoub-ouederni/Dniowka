#!/usr/bin/env node
/**
 * WCAG contrast of every text/background pair the app uses (spec §6.4: ≥ 4.5:1).
 *
 *   node scripts/check-contrast.mjs
 *
 * Keep PAIRS in sync with app/src/index.css tokens. Exits 1 if a pair fails.
 * A translucent foreground is given as [hex, alpha] and blended over its background.
 */
const T = {
  cobalt: "#1b2cc1",
  paper: "#fbfbf7",
  white: "#ffffff",
  ink: "#111111",
  muted: "#55554f",
  faint: "#66665e",
  yellow: "#ffe45c",
  note: "#fff1a8",
  red: "#c8102e",
  mint: "#7cf2b0",
};

const PAIRS = [
  ["body text", T.ink, T.paper],
  ["muted text", T.muted, T.paper],
  ["muted text on receipt", T.muted, T.white],
  ["future coupon value", T.faint, T.white],
  ["earned coupon value", T.ink, T.yellow],
  ["stub number", T.muted, T.white],
  ["header text", T.paper, T.cobalt],
  ["links", T.cobalt, T.paper],
  ["links on receipt", T.cobalt, T.white],
  ["refusal text / stamp", T.red, T.paper],
  ["refusal on receipt", T.red, T.white],
  ["paid stamp", T.cobalt, T.paper],
  ["primary button", T.paper, T.ink],
  ["available pill", T.ink, T.yellow],
  ["countdown chip", T.yellow, T.ink],
  ["sticky note", T.ink, T.note],
  ["success panel", T.ink, T.mint],
  ["+X zł on ink", T.mint, T.ink],
  ["flip digits", T.yellow, T.ink],
  ["big screen text", T.paper, T.cobalt],
  ["big screen tag (soon)", [T.paper, 0.8], T.cobalt],
  ["flip units", [T.paper, 0.85], T.cobalt],
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const blend = ([fg, a], bg) => hex(fg).map((c, i) => c * a + hex(bg)[i] * (1 - a));

let failed = 0;
for (const [name, fg, bg] of PAIRS) {
  const f = Array.isArray(fg) ? blend(fg, bg) : hex(fg);
  const [l1, l2] = [lum(f), lum(hex(bg))].sort((a, b) => b - a);
  const ratio = (l1 + 0.05) / (l2 + 0.05);
  const ok = ratio >= 4.5;
  if (!ok) failed++;
  console.log(`${ok ? "✔" : "✘"} ${ratio.toFixed(2).padStart(5)}:1  ${name}`);
}
process.exit(failed ? 1 : 0);
