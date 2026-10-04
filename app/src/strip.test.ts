import { describe, expect, it } from "vitest";

import { couponValues, stripCoupons, takenWhole, tearSteps } from "./strip";

const NET = 600_000n; // 6 000,00 zł → 200,00 zł a day

describe("couponValues", () => {
  it("splits the net salary into 30 day values that add up exactly", () => {
    const values = couponValues(NET);
    expect(values).toHaveLength(30);
    expect(values.every((v) => v === 20_000n)).toBe(true);
    const odd = couponValues(100_001n);
    expect(odd.reduce((a, b) => a + b, 0n)).toBe(100_001n);
    expect(odd[0]).toBe(3_333n);
    expect(odd[29]).toBe(3_334n);
  });
});

const base = {
  earned: 250_000n, // 12.5 days
  withdrawn: 80_000n, // 4 days
  net: NET,
  periodStart: 0,
  periodEnd: 300,
  endTs: null as number | null,
  now: 125,
};

describe("stripCoupons", () => {
  it("fills earned days from the program's earned figure, with today partly filled", () => {
    const c = stripCoupons(base);
    expect(c[11].fill).toBe(1);
    expect(c[12].fill).toBeCloseTo(0.5, 5);
    expect(c[13].fill).toBe(0);
    expect(c[12].today).toBe(true);
    expect(c.filter((x) => x.today)).toHaveLength(1);
  });

  it("marks what was taken, including a partly taken day", () => {
    const c = stripCoupons({ ...base, withdrawn: 85_000n });
    expect(c[3].taken).toBe(1);
    expect(c[4].taken).toBeCloseTo(0.25, 5);
    expect(c[5].taken).toBe(0);
  });

  it("marks days that start at or after the end of employment as outside the contract", () => {
    const c = stripCoupons({ ...base, endTs: 200 });
    expect(c[19].off).toBe(false);
    expect(c[20].off).toBe(true);
    expect(c[29].off).toBe(true);
    // a day cut in the middle is still inside the contract
    expect(stripCoupons({ ...base, endTs: 205 })[20].off).toBe(false);
  });

  it("never marks today before the month starts or after it ends", () => {
    expect(stripCoupons({ ...base, now: -5 }).some((x) => x.today)).toBe(false);
    expect(stripCoupons({ ...base, now: 300 }).some((x) => x.today)).toBe(false);
  });
});

describe("takenWhole", () => {
  it("counts fully taken days", () => {
    expect(takenWhole(0n, NET)).toBe(0);
    expect(takenWhole(80_000n, NET)).toBe(4);
    expect(takenWhole(85_000n, NET)).toBe(4);
    expect(takenWhole(NET, NET)).toBe(30);
  });
});

describe("tearSteps", () => {
  it("tears whole days after what was taken, the last step being everything available", () => {
    expect(tearSteps(80_000n, 50_000n, NET)).toEqual([20_000n, 40_000n, 50_000n]);
    expect(tearSteps(80_000n, 40_000n, NET)).toEqual([20_000n, 40_000n]);
  });

  it("completes a partly taken day first", () => {
    expect(tearSteps(85_000n, 60_000n, NET)).toEqual([15_000n, 35_000n, 55_000n, 60_000n]);
  });

  it("offers nothing when nothing is available", () => {
    expect(tearSteps(80_000n, 0n, NET)).toEqual([]);
  });
});
