import assert from "node:assert/strict";
import { test } from "node:test";

import { type ResetStream, cancelFrom, planReset } from "./reset-plan.ts";

const base: ResetStream = {
  status: "active",
  periodStart: 1_000,
  periodEnd: 1_300,
  payday: 1_300,
};

test("an active salary past payday is settled", () => {
  assert.deepEqual(planReset(base, 1_300), { kind: "settle" });
  assert.deepEqual(planReset(base, 5_000), { kind: "settle" });
});

test("an active salary before payday waits for payday", () => {
  assert.deepEqual(planReset(base, 1_299), { kind: "wait", until: 1_300, then: "settle" });
});

test("the grace period is a tenth of the month, rounded down like the program", () => {
  assert.equal(cancelFrom({ ...base, periodEnd: 1_305 }), 1_030);
  assert.equal(cancelFrom({ ...base, periodStart: 0, periodEnd: 2_592_000 }), 259_200);
});

test("an invite past its grace period is cancelled, before it waits", () => {
  const invite = { ...base, status: "invited" as const };
  assert.deepEqual(planReset(invite, 1_030), { kind: "cancel" });
  assert.deepEqual(planReset(invite, 1_029), { kind: "wait", until: 1_030, then: "cancel" });
});

test("paid and cancelled salaries are left alone", () => {
  assert.deepEqual(planReset({ ...base, status: "settled" }, 9_999), { kind: "done" });
  assert.deepEqual(planReset({ ...base, status: "cancelled" }, 9_999), { kind: "done" });
});
