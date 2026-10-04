import { afterEach, describe, expect, it } from "vitest";

import idl from "./chain/idl/dniowka.json";
import { copy, en, getLang, pl, setLang } from "./copy";

/** Spec §3.3, in both languages (portfel = wallet, podpis = signature, transakcja…). */
const BANNED =
  /\b(wallets?|tokens?|mints?|pda|sol|lamports?|transactions?|signatures?|hash(es)?|solana|blockchain|portfel\w*|token\w*|transakcj\w*|podpis\w*|łańcuch\w*)\b/i;

/** Every user-facing string: functions are called with sample arguments. */
function strings(node: unknown, path: string, out: [string, string][]) {
  if (typeof node === "string") out.push([path, node]);
  else if (typeof node === "function") {
    const value = (node as (...a: unknown[]) => unknown)(1, 2, 3);
    strings(value, `${path}()`, out);
  } else if (Array.isArray(node)) node.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      // Jury-facing on purpose: the drawer and the big screen's integration labels.
      if (k === "hood" || k === "integrations") continue;
      strings(v, path ? `${path}.${k}` : k, out);
    }
  }
}

function shape(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(shape);
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, shape(v)]),
    );
  }
  return typeof node;
}

const context = { earned: 240_000n, available: 168_000n, payday: 1, cancelFrom: 1 };

describe.each([
  ["en", en],
  ["pl", pl],
])("copy (%s)", (_, c) => {
  it("never uses crypto vocabulary outside Under the hood", () => {
    const all: [string, string][] = [];
    strings(c, "", all);
    for (const e of idl.errors) all.push([e.name, c.failure.program(e.name, context)]);
    expect(all.length).toBeGreaterThan(150);
    expect(all.filter(([, text]) => BANNED.test(text))).toEqual([]);
  });

  it("has a human sentence for every program error", () => {
    for (const e of idl.errors) {
      expect(c.failure.program(e.name, context)).not.toBe(c.failure.program("Nope", {}));
    }
  });
});

describe("Polish copy", () => {
  afterEach(() => setLang("en"));

  it("has exactly the same keys as English", () => {
    expect(shape(pl)).toEqual(shape(en));
  });

  it("is actually translated", () => {
    const e: [string, string][] = [];
    const p: [string, string][] = [];
    strings(en, "", e);
    strings(pl, "", p);
    const same = e.filter(([path, text], i) => p[i][0] === path && p[i][1] === text);
    // Brand names, stamps and amounts stay the same; sentences must not.
    expect(same.length / e.length).toBeLessThan(0.1);
  });

  it("switches the live copy", () => {
    expect(getLang()).toBe("en");
    setLang("pl");
    expect(getLang()).toBe("pl");
    expect(copy.tagline).toBe(pl.tagline);
    setLang("en");
    expect(copy.tagline).toBe(en.tagline);
  });
});
