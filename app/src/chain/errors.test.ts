import { describe, expect, it } from "vitest";

import {
  classifyFailure,
  errorName,
  parseCancelFrom,
  parseCutCaps,
  parseEarnedAvailable,
  parseProgramError,
} from "./errors";

const PROGRAM = "EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3";

// Logs as devnet returned them for the M1 smoke run's refused over-withdrawal.
const refusedLogs = [
  `Program ${PROGRAM} invoke [1]`,
  "Program log: Instruction: WithdrawEarned",
  "Program log: earned 240000 available 88000",
  "Program log: AnchorError thrown in programs/dniowka/src/instructions/withdraw_earned.rs:55. Error Code: ExceedsAvailable. Error Number: 6000. Error Message: Amount is more than is available now.",
  `Program ${PROGRAM} consumed 21345 of 200000 compute units`,
  `Program ${PROGRAM} failed: custom program error: 0x1770`,
];

describe("errorName", () => {
  it("maps program error codes to their IDL names", () => {
    expect(errorName(6000)).toBe("ExceedsAvailable");
    expect(errorName(6001)).toBe("PaymentLocked");
    expect(errorName(6004)).toBe("TooEarlyForPayday");
    expect(errorName(6021)).toBe("EmployerCannotBeEmployee");
  });

  it("knows the M3 errors, appended after the M1 ones", () => {
    expect(errorName(6022)).toBe("InvalidAdjustmentReason");
    expect(errorName(6023)).toBe("AdjustmentTooLarge");
    expect(errorName(6024)).toBe("AdjustmentClosed");
    expect(errorName(6025)).toBe("NoAdjustment");
    expect(errorName(6026)).toBe("AdjustmentChanged");
    expect(errorName(6027)).toBe("CancelTooEarly");
  });

  it("returns null for codes the program does not define", () => {
    expect(errorName(2003)).toBeNull();
    expect(errorName(6999)).toBeNull();
  });
});

describe("parseEarnedAvailable", () => {
  it("reads the program's own earned/available log line", () => {
    expect(parseEarnedAvailable(refusedLogs)).toEqual({ earned: 240_000n, available: 88_000n });
  });

  it("handles amounts beyond Number precision", () => {
    expect(parseEarnedAvailable(["Program log: earned 18446744073709551615 available 1"])).toEqual({
      earned: 18_446_744_073_709_551_615n,
      available: 1n,
    });
  });

  it("returns null when the line is absent", () => {
    expect(parseEarnedAvailable([])).toBeNull();
    expect(parseEarnedAvailable(null)).toBeNull();
    expect(parseEarnedAvailable(["Program log: Instruction: Settle"])).toBeNull();
  });
});

describe("parseProgramError", () => {
  it("reads the Anchor error from the logs", () => {
    expect(parseProgramError(refusedLogs)).toEqual({ code: 6000, name: "ExceedsAvailable" });
  });

  it("reads account-constraint errors", () => {
    const logs = [
      "Program log: AnchorError caused by account: stream. Error Code: PaymentLocked. Error Number: 6001. Error Message: This salary is secured. Nobody can take it back.",
    ];
    expect(parseProgramError(logs)).toEqual({ code: 6001, name: "PaymentLocked" });
  });

  it("falls back to the custom error code in the transaction error", () => {
    expect(parseProgramError(null, { InstructionError: [0, { Custom: 6004 }] })).toEqual({
      code: 6004,
      name: "TooEarlyForPayday",
    });
  });

  it("ignores custom codes that are not ours (e.g. the token program's)", () => {
    expect(parseProgramError(null, { InstructionError: [0, { Custom: 1 }] })).toBeNull();
    expect(parseProgramError(["Program log: hello"])).toBeNull();
  });

  it("reports Anchor framework errors by number", () => {
    const logs = [
      "Program log: AnchorError caused by account: employer. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.",
    ];
    expect(parseProgramError(logs)).toEqual({ code: 3012, name: "AccountNotInitialized" });
  });
});

describe("classifyFailure", () => {
  it("recognises a refusal by the program", () => {
    const e = Object.assign(new Error("Simulation failed"), { logs: refusedLogs });
    expect(classifyFailure(e)).toEqual({
      kind: "program",
      code: 6000,
      name: "ExceedsAvailable",
      earned: 240_000n,
      available: 88_000n,
    });
  });

  it("recognises a refusal reported only as text by the wallet", () => {
    const e = new Error(
      "Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1770",
    );
    expect(classifyFailure(e)).toEqual({ kind: "program", code: 6000, name: "ExceedsAvailable" });
  });

  it("recognises the person cancelling in their app", () => {
    const e = Object.assign(new Error("User rejected the request."), {
      name: "WalletSignTransactionError",
    });
    expect(classifyFailure(e)).toEqual({ kind: "cancelled" });
    expect(classifyFailure({ code: 4001, message: "rejected" })).toEqual({ kind: "cancelled" });
  });

  it("recognises a missing fee balance", () => {
    expect(
      classifyFailure(
        new Error(
          "Simulation failed. Message: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.",
        ),
      ),
    ).toEqual({ kind: "noFees" });
    expect(
      classifyFailure(
        Object.assign(new Error("failed"), {
          logs: ["Transfer: insufficient lamports 0, need 2039280"],
        }),
      ),
    ).toEqual({ kind: "noFees" });
  });

  it("recognises network trouble", () => {
    expect(classifyFailure(new TypeError("Failed to fetch"))).toEqual({ kind: "network" });
  });

  it("keeps anything else as unknown with its message", () => {
    expect(classifyFailure(new Error("boom"))).toEqual({ kind: "unknown", message: "boom" });
    expect(classifyFailure("weird")).toEqual({ kind: "unknown", message: "weird" });
  });
});

describe("M3 log lines", () => {
  const proposeLogs = [
    `Program ${PROGRAM} invoke [1]`,
    "Program log: Instruction: ProposeAdjustment",
    "Program log: cut cap 180000 with consent 520000",
    "Program log: AnchorError thrown in programs/dniowka/src/instructions/propose_adjustment.rs:44. Error Code: AdjustmentTooLarge. Error Number: 6023. Error Message: Adjustment would cut into pay that was already taken.",
  ];

  it("reads the adjustment caps propose_adjustment logs", () => {
    expect(parseCutCaps(proposeLogs)).toEqual({ withoutConsent: 180_000n, withConsent: 520_000n });
    expect(parseCutCaps(refusedLogs)).toBeNull();
    expect(parseCutCaps(undefined)).toBeNull();
  });

  it("reads when a cancelled invite becomes allowed", () => {
    const logs = [
      "Program log: Instruction: CancelUnaccepted",
      "Program log: cancel allowed from 1800259200",
      "Program log: AnchorError thrown in programs/dniowka/src/instructions/cancel_unaccepted.rs:60. Error Code: CancelTooEarly. Error Number: 6027. Error Message: This invite can't be cancelled yet.",
    ];
    expect(parseCancelFrom(logs)).toBe(1_800_259_200);
    expect(parseCancelFrom(proposeLogs)).toBeNull();
    const f = classifyFailure({ logs });
    expect(f).toMatchObject({ kind: "program", name: "CancelTooEarly", cancelFrom: 1_800_259_200 });
  });
});
