import { describe, expect, it } from "vitest";

import { confirmThrown } from "./send";

describe("confirmThrown", () => {
  it("reads a bare transaction error thrown by confirmTransaction as the program's refusal", () => {
    const f = confirmThrown({ InstructionError: [0, { Custom: 6003 }] }, []);
    expect(f).toMatchObject({ kind: "program", code: 6003, name: "BackdatingNotAllowed" });
  });

  it("keeps the numbers from the logs when they could be read", () => {
    const logs = [
      "Program log: earned 399666 available 199766",
      "Program log: AnchorError thrown in withdraw_earned.rs:69. Error Code: ExceedsAvailable. Error Number: 6000. Error Message: Amount is more than is available now.",
    ];
    const f = confirmThrown({ InstructionError: [0, { Custom: 6000 }] }, logs);
    expect(f).toMatchObject({ kind: "program", name: "ExceedsAvailable", earned: 399666n });
  });

  it("still treats other errors as before", () => {
    expect(confirmThrown(new Error("Failed to fetch"), [])).toEqual({ kind: "network" });
  });
});
