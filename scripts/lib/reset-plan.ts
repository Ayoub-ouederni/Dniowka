/**
 * What `reset-demo` does with each salary. Only picks which instruction to send; the program
 * still checks every rule and refuses anything early.
 */
export type ResetStream = {
  status: "invited" | "active" | "settled" | "cancelled";
  periodStart: number;
  periodEnd: number;
  payday: number;
};

export type ResetStep =
  | { kind: "settle" }
  | { kind: "cancel" }
  | { kind: "wait"; until: number; then: "settle" | "cancel" }
  | { kind: "done" };

/** When `cancel_unaccepted` opens: a tenth of the month after it starts (integer division). */
export function cancelFrom(s: Pick<ResetStream, "periodStart" | "periodEnd">): number {
  return s.periodStart + Math.trunc((s.periodEnd - s.periodStart) / 10);
}

export function planReset(s: ResetStream, now: number): ResetStep {
  if (s.status === "active") {
    return now >= s.payday ? { kind: "settle" } : { kind: "wait", until: s.payday, then: "settle" };
  }
  if (s.status === "invited") {
    const from = cancelFrom(s);
    return now >= from ? { kind: "cancel" } : { kind: "wait", until: from, then: "cancel" };
  }
  return { kind: "done" };
}
