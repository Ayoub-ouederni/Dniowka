import { Connection } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import { parseFeedTx } from "./feed";
import { makeProgram } from "./program";

const PROGRAM = "EhUqkYYSarPPpec8x8dvgMSrKR8CWdCk11UA7iReNaV3";
const STREAM = "9ev9Ujhp5ryPa9ytVvRCnKJNnXeVqNcXVg2mjcc7YFoC";
// No request is made: the program object is only used to decode logs.
const program = makeProgram(new Connection("http://127.0.0.1:1"));

// Logs of the devnet smoke run after the M3 upgrade (payday and a withdrawal).
const settleLogs = [
  `Program ${PROGRAM} invoke [1]`,
  "Program log: Instruction: Settle",
  "Program data: 6NIoEY58ke6AlBPyh2EH+3DGL7f9hk1+jFI0hLPF8HWOVbTdgeUmRyChBwAAAAAAAAAAAAAAAAAAAAAAAAAAAMAnCQAAAAAAAAAAAAAAAADf58FqAAAAAA==",
  `Program ${PROGRAM} success`,
];
const withdrawLogs = [
  `Program ${PROGRAM} invoke [1]`,
  "Program log: Instruction: WithdrawEarned",
  "Program data: FFnfxsJ82w2AlBPyh2EH+3DGL7f9hk1+jFI0hLPF8HWOVbTdgeUmRzR/AFGmCqWc7Co4UtJRmx3OIgr6N/036rpv9Dy17//LoIYBAAAAAACghgEAAAAAAEANAwAAAAAAQJwAAAAAAACi58FqAAAAAA==",
  `Program ${PROGRAM} success`,
];
const backdatedLogs = [
  `Program ${PROGRAM} invoke [1]`,
  "Program log: Instruction: EndEmployment",
  "Program log: AnchorError thrown in programs/dniowka/src/instructions/end_employment.rs:28. Error Code: BackdatingNotAllowed. Error Number: 6003. Error Message: End date can't be in the past.",
  `Program ${PROGRAM} failed: custom program error: 0x1773`,
];

const tx = (logs: string[], failed = false, accounts: string[] = []) => ({
  signature: "sig",
  time: 1_791_092_704,
  logs,
  failed,
  accounts,
});
const watched = (s: string) => s === STREAM;

describe("parseFeedTx", () => {
  it("reads payday from the program's Settled event", () => {
    expect(parseFeedTx(program, tx(settleLogs), watched)).toEqual([
      {
        signature: "sig",
        time: 1_791_092_704,
        stream: STREAM,
        kind: "paid",
        pay: 500_000n,
        refund: 0n,
        cut: 0n,
      },
    ]);
  });

  it("reads a withdrawal", () => {
    expect(parseFeedTx(program, tx(withdrawLogs), watched)).toMatchObject([
      { kind: "took", amount: 100_000n, stream: STREAM },
    ]);
  });

  it("ignores salaries that aren't watched", () => {
    expect(parseFeedTx(program, tx(settleLogs), () => false)).toEqual([]);
  });

  it("links an on-chain refusal to the watched salary it touched", () => {
    const accounts = ["Someone1111111111111111111111111111111111", STREAM, PROGRAM];
    expect(parseFeedTx(program, tx(backdatedLogs, true, accounts), watched)).toMatchObject([
      { kind: "refused", error: "BackdatingNotAllowed", stream: STREAM },
    ]);
    expect(parseFeedTx(program, tx(backdatedLogs, true, [PROGRAM]), watched)).toEqual([]);
  });
});
