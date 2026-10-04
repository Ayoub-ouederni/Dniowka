import { beforeEach, describe, expect, it } from "vitest";

import { importLabels, readLabels } from "./labels";

const A = "EhREgQSUNKWPVfbfGqWdcQEwreyQbCKJBHcpogDMMbBU";
const S1 = "6fDNMTmxqqMTK3Ng8Sp5bgT9DHwDv4kKn41ugWVv7sDv";

describe("importLabels", () => {
  beforeEach(() => localStorage.clear());

  it("saves salary names and the company on this device, and says where to go next", () => {
    const params = new URLSearchParams({ a: A, c: "Piekarnia Nowak", [S1]: "Oksana" });
    expect(importLabels(params)).toBe(`#/screen/${A}`);
    expect(readLabels()).toEqual({ [S1]: "Oksana" });
    expect(localStorage.getItem(`dniowka:company:${A}`)).toBe("Piekarnia Nowak");
  });

  it("ignores keys that aren't account addresses", () => {
    importLabels(new URLSearchParams({ x: "1", [S1]: "Marek" }));
    expect(readLabels()).toEqual({ [S1]: "Marek" });
  });

  it("goes to the start page without an employer", () => {
    expect(importLabels(new URLSearchParams())).toBe("#/");
  });
});
