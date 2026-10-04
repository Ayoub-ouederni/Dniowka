import { useState } from "react";

import { parseZl } from "./format";

export type TearMode = "idle" | "tear" | "review";
export type Tear = ReturnType<typeof useTear>;

/** Tear mode: idle → choosing coupons (stepper / tap / exact amount) → receipt. */
export function useTear(initialMode: TearMode = "idle", initialK = 1) {
  const [mode, setMode] = useState<TearMode>(initialMode);
  const [k, setK] = useState(initialK);
  const [typed, setTyped] = useState<string | null>(null);
  return {
    mode,
    typed,
    /** Stepper position, kept inside the current steps (they move as more is earned). */
    k: (steps: bigint[]) => Math.max(1, Math.min(k, steps.length)),
    amountFor: (steps: bigint[]): bigint | null =>
      typed !== null ? parseZl(typed) : (steps[Math.max(1, Math.min(k, steps.length)) - 1] ?? null),
    open: () => {
      setMode("tear");
      setK(1);
      setTyped(null);
    },
    pick: (next: number, max: number) => {
      setTyped(null);
      setK(Math.max(1, Math.min(next, max)));
    },
    type: setTyped,
    review: () => setMode("review"),
    back: () => setMode("tear"),
    close: () => {
      setMode("idle");
      setTyped(null);
    },
  };
}
