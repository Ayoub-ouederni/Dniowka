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
