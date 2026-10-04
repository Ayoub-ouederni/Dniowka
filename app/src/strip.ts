/**
 * How the 30 day-coupons look. Display only: the fill is the program's `earned` (read by
 * simulation), what is available is the program's `available`; nothing here decides pay.
 */
import { COUPONS, couponsFilled } from "./format";

/** Where day `j` ends, in grosze: floor(net × j / 30), so the 30 days add up to net exactly. */
const boundary = (net: bigint, j: number) => (net * BigInt(j)) / BigInt(COUPONS);

/** The zł printed on each coupon. */
export function couponValues(net: bigint): bigint[] {
  return Array.from({ length: COUPONS }, (_, i) => boundary(net, i + 1) - boundary(net, i));
}

export type Coupon = {
  day: number;
  value: bigint;
  /** 0..1, how much of the day is earned (from the program's figure). */
  fill: number;
  /** 0..1, how much of the day was already taken. */
  taken: number;
  /** The day starts at or after the end of employment. */
  off: boolean;
  /** The cluster clock is inside this day. */
  today: boolean;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function stripCoupons(p: {
  earned: bigint;
  withdrawn: bigint;
  net: bigint;
  periodStart: number;
  periodEnd: number;
  endTs: number | null;
  now: number;
}): Coupon[] {
  const filled = couponsFilled(p.earned, p.net);
  const taken = couponsFilled(p.withdrawn, p.net);
  const values = couponValues(p.net);
  const length = p.periodEnd - p.periodStart;
  return values.map((value, i) => {
    const start = p.periodStart + (length * i) / COUPONS;
    const end = p.periodStart + (length * (i + 1)) / COUPONS;
    const off = p.endTs !== null && p.endTs <= start;
    return {
      day: i + 1,
      value,
      fill: clamp01(filled - i),
      taken: clamp01(taken - i),
      off,
      today: !off && p.now >= start && p.now < end,
    };
  });
}

/** Days taken in full. */
export function takenWhole(withdrawn: bigint, net: bigint): number {
  let j = 0;
  while (j < COUPONS && boundary(net, j + 1) <= withdrawn) j++;
  return j;
}

/**
 * The amounts the tear stepper offers: one more whole day each step (a partly taken day is
 * completed first), the last step being everything the program says is available.
 */
export function tearSteps(withdrawn: bigint, available: bigint, net: bigint): bigint[] {
  const steps: bigint[] = [];
  if (available <= 0n) return steps;
  for (let j = takenWhole(withdrawn, net) + 1; j <= COUPONS; j++) {
    const amount = boundary(net, j) - withdrawn;
    if (amount >= available) break;
    if (amount > 0n) steps.push(amount);
  }
  steps.push(available);
  return steps;
}
