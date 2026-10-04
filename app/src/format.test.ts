import { describe, expect, it } from "vitest";

import {
  couponsFilled,
  fromWarsawInput,
  toWarsawInput,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatZl,
  parseZl,
} from "./format";

const NBSP = "\u00a0";

describe("formatZl", () => {
  it("formats grosze as Polish zł with a no-break space between thousands", () => {
    expect(formatZl(240_000n)).toBe(`2${NBSP}400,00${NBSP}zł`);
    expect(formatZl(600_000)).toBe(`6${NBSP}000,00${NBSP}zł`);
    expect(formatZl(123_456_789n)).toBe(`1${NBSP}234${NBSP}567,89${NBSP}zł`);
  });

  it("keeps two decimals and small amounts", () => {
    expect(formatZl(0n)).toBe(`0,00${NBSP}zł`);
    expect(formatZl(5n)).toBe(`0,05${NBSP}zł`);
    expect(formatZl(80_050n)).toBe(`800,50${NBSP}zł`);
    expect(formatZl(99_999n)).toBe(`999,99${NBSP}zł`);
  });

  it("handles negatives and amounts beyond Number precision", () => {
    expect(formatZl(-80_000n)).toBe(`-800,00${NBSP}zł`);
    expect(formatZl(18_446_744_073_709_551_615n)).toBe(
      `184${NBSP}467${NBSP}440${NBSP}737${NBSP}095${NBSP}516,15${NBSP}zł`,
    );
  });
});

describe("parseZl", () => {
  it("reads what people type into grosze", () => {
    expect(parseZl("800")).toBe(80_000n);
    expect(parseZl("800,5")).toBe(80_050n);
    expect(parseZl("800.50")).toBe(80_050n);
    expect(parseZl(" 2 400,00 zł ")).toBe(240_000n);
    expect(parseZl(`6${NBSP}000`)).toBe(600_000n);
    expect(parseZl("0,01")).toBe(1n);
  });

  it("rejects anything that is not a plain amount", () => {
    expect(parseZl("")).toBeNull();
    expect(parseZl("abc")).toBeNull();
    expect(parseZl("1,234")).toBeNull();
    expect(parseZl("-5")).toBeNull();
    expect(parseZl("1,2,3")).toBeNull();
  });
});

describe("dates (Europe/Warsaw)", () => {
  // 2026-12-02 10:05 UTC = 11:05 in Warsaw (CET).
  const ts = Date.UTC(2026, 11, 2, 10, 5) / 1000;

  it("formats dates as dd.mm.yyyy", () => {
    expect(formatDate(ts)).toBe("02.12.2026");
  });

  it("formats date and time as dd.mm.yyyy hh:mm", () => {
    expect(formatDateTime(ts)).toBe("02.12.2026 11:05");
    // Summer time: 2026-07-01 22:30 UTC is already 2 July in Warsaw.
    expect(formatDateTime(Date.UTC(2026, 6, 1, 22, 30) / 1000)).toBe("02.07.2026 00:30");
  });
});

describe("formatCountdown", () => {
  it("never reads like a clock time", () => {
    expect(formatCountdown(0)).toBe("0 s");
    expect(formatCountdown(-30)).toBe("0 s");
    expect(formatCountdown(42)).toBe("42 s");
    expect(formatCountdown(65)).toBe("1 min 05 s");
    expect(formatCountdown(3_599)).toBe("59 min 59 s");
  });

  it("drops seconds above an hour, minutes above a day", () => {
    expect(formatCountdown(3_600)).toBe("1 h 00 min");
    expect(formatCountdown(86_399)).toBe("23 h 59 min");
    expect(formatCountdown(86_400 * 12 + 3_661)).toBe("12 d 1 h");
  });
});

describe("couponsFilled", () => {
  it("turns program-reported earned into day coupons of net / 30", () => {
    expect(couponsFilled(240_000n, 600_000n)).toBe(12);
    expect(couponsFilled(0n, 600_000n)).toBe(0);
    expect(couponsFilled(600_000n, 600_000n)).toBe(30);
    expect(couponsFilled(250_000n, 600_000n)).toBeCloseTo(12.5, 5);
  });

  it("never goes outside 0..30", () => {
    expect(couponsFilled(900_000n, 600_000n)).toBe(30);
    expect(couponsFilled(10n, 0n)).toBe(0);
  });
});

describe("Warsaw date-time input", () => {
  // 2026-12-02 11:05:30 in Warsaw (winter, UTC+1).
  const winter = Date.UTC(2026, 11, 2, 10, 5, 30) / 1000;
  // 2026-07-02 00:30:00 in Warsaw (summer, UTC+2).
  const summer = Date.UTC(2026, 6, 1, 22, 30) / 1000;

  it("shows a moment as the Polish wall time a date-time picker expects", () => {
    expect(toWarsawInput(winter)).toBe("2026-12-02T11:05:30");
    expect(toWarsawInput(summer)).toBe("2026-07-02T00:30:00");
  });

  it("reads a picker value as Polish wall time, with or without seconds", () => {
    expect(fromWarsawInput("2026-12-02T11:05:30")).toBe(winter);
    expect(fromWarsawInput("2026-07-02T00:30")).toBe(summer);
  });

  it("round-trips across the year", () => {
    for (let month = 0; month < 12; month++) {
      const ts = Date.UTC(2027, month, 15, 13, 7, 9) / 1000;
      expect(fromWarsawInput(toWarsawInput(ts))).toBe(ts);
    }
  });

  it("rejects what isn't a date-time", () => {
    expect(fromWarsawInput("")).toBeNull();
    expect(fromWarsawInput("tomorrow")).toBeNull();
    expect(fromWarsawInput("2026-13-40T99:99")).toBeNull();
  });
});
