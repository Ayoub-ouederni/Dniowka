import { describe, expect, it } from "vitest";

import { MAX_POLL_MS, pollDelay } from "./poll";

describe("pollDelay", () => {
  it("keeps the normal pace while reads succeed", () => {
    expect(pollDelay(4_000, 0)).toBe(4_000);
  });

  it("doubles after each failed read in a row, so a rate-limited RPC gets room", () => {
    expect(pollDelay(4_000, 1)).toBe(8_000);
    expect(pollDelay(4_000, 2)).toBe(16_000);
  });

  it("never waits longer than the cap", () => {
    expect(pollDelay(4_000, 3)).toBe(MAX_POLL_MS);
    expect(pollDelay(4_000, 50)).toBe(MAX_POLL_MS);
  });
});
