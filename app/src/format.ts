/**
 * Display formatting only. Every amount here comes from the program; nothing in this
 * file decides what anyone is owed (spec §0.5 rule 2).
 */

const NBSP = "\u00a0";
const TIME_ZONE = "Europe/Warsaw";
export const COUPONS = 30;

/** Grosze → `2 400,00 zł` (no-break spaces; `pl-PL` alone does not group 4-digit numbers). */
export function formatZl(grosze: bigint | number): string {
  const value = BigInt(grosze);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const cents = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${whole},${cents}${NBSP}zł`;
}

/** What a person types (`800`, `800,50`, `2 400 zł`) → grosze, or null if it isn't an amount. */
export function parseZl(input: string): bigint | null {
  const clean = input.replace(/zł/gi, "").replace(/[\s\u00a0\u202f]/g, "");
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function warsawParts(unixSeconds: number) {
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { d: get("day"), m: get("month"), y: get("year"), h: get("hour"), min: get("minute") };
}

/** `02.12.2026` (Polish time). */
export function formatDate(unixSeconds: number): string {
  const { d, m, y } = warsawParts(unixSeconds);
  return `${d}.${m}.${y}`;
}

/** `02.12.2026 11:05` (Polish time); demo periods last minutes, so the time matters. */
export function formatDateTime(unixSeconds: number): string {
  const { d, m, y, h, min } = warsawParts(unixSeconds);
  return `${d}.${m}.${y} ${h}:${min}`;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** Warsaw wall time of a moment, as calendar fields (seconds included). */
function warsawFields(unixSeconds: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    min: get("minute"),
    s: get("second"),
  };
}

/** A moment → `2026-12-02T11:05:30`, the Polish wall time for a date-time picker. */
export function toWarsawInput(unixSeconds: number): string {
  const f = warsawFields(unixSeconds);
  return `${f.y}-${pad(f.m)}-${pad(f.d)}T${pad(f.h)}:${pad(f.min)}:${pad(f.s)}`;
}

/** A date-time picker value, read as Polish wall time → unix seconds (null if invalid). */
export function fromWarsawInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, min, s] = m.slice(1).map((v) => Number(v ?? "0"));
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || min > 59 || s > 59) return null;
  const asUtc = Date.UTC(y, mo - 1, d, h, min, s) / 1000;
  // Shift by Warsaw's offset at that moment; a second pass settles DST edges.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const f = warsawFields(guess);
    const shown = Date.UTC(f.y, f.m - 1, f.d, f.h, f.min, f.s) / 1000;
    guess += asUtc - shown;
  }
  return guess;
}

/** Seconds left → `42 s`, `6 min 05 s`, `1 h 04 min` or `12 d 1 h` (never like a clock time). */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${pad(minutes)} min`;
  if (minutes > 0) return `${minutes} min ${pad(secs)} s`;
  return `${secs} s`;
}

/** How many of the 30 day-coupons the program's `earned` fills (fractional for today). */
export function couponsFilled(earned: bigint, net: bigint): number {
  if (net <= 0n) return 0;
  const milli = Number((earned * BigInt(COUPONS) * 1000n) / net) / 1000;
  return Math.min(COUPONS, Math.max(0, milli));
}

export type FlipGroup = { digits: string; unit: "d" | "h" | "min" | "s" };

/** Seconds left → digit groups for the big screen's flip clock, each with its unit. */
export function flipDigits(seconds: number): FlipGroup[] {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  const secs = s % 60;
  if (days > 0) {
    return [
      { digits: pad(days), unit: "d" },
      { digits: pad(hours), unit: "h" },
      { digits: pad(minutes), unit: "min" },
    ];
  }
  if (hours > 0) {
    return [
      { digits: pad(hours), unit: "h" },
      { digits: pad(minutes), unit: "min" },
      { digits: pad(secs), unit: "s" },
    ];
  }
  return [
    { digits: pad(minutes), unit: "min" },
    { digits: pad(secs), unit: "s" },
  ];
}
