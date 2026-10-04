/**
 * Reads. "Now" is the cluster clock; earned / available come from the program itself
 * (a simulated `withdraw_earned` logs them). The app never computes what is owed.
 */
import { EventParser } from "@anchor-lang/core";
import {
  type Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { type CutCaps, parseCutCaps, parseEarnedAvailable } from "./errors";
import {
  type DniowkaProgram,
  employerPda,
  proposeAdjustmentIx,
  streamPda,
  withdrawEarnedIx,
  zlAccount,
} from "./program";

export type StreamStatus = "invited" | "active" | "settled" | "cancelled";

export type EmployerView = {
  address: PublicKey;
  authority: PublicKey;
  mint: PublicKey;
  defaultFloorBps: number;
  streamCount: bigint;
};

export type StreamView = {
  address: PublicKey;
  employer: PublicKey;
  /** While invited: the hint (default key = open invite). */
  employee: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
  id: bigint;
  net: bigint;
  periodStart: number;
  periodEnd: number;
  payday: number;
  floorBps: number;
  funded: bigint;
  withdrawn: bigint;
  endTs: number | null;
  /** Proposed payday reduction (0 = none), its reason code and the employee's consent. */
  adjustment: bigint;
  adjustmentReason: number;
  adjustmentAccepted: boolean;
  status: StreamStatus;
};

type BNLike = { toString(): string };
const big = (v: BNLike) => BigInt(v.toString());
const num = (v: BNLike) => Number(v.toString());

/* eslint-disable @typescript-eslint/no-explicit-any -- Anchor's decoded account shapes */
function toEmployer(address: PublicKey, a: any): EmployerView {
  return {
    address,
    authority: a.authority,
    mint: a.mint,
    defaultFloorBps: a.defaultFloorBps,
    streamCount: big(a.streamCount),
  };
}

function toStream(address: PublicKey, a: any): StreamView {
  return {
    address,
    employer: a.employer,
    employee: a.employee,
    mint: a.mint,
    vault: a.vault,
    id: big(a.id),
    net: big(a.netAmount),
    periodStart: num(a.periodStart),
    periodEnd: num(a.periodEnd),
    payday: num(a.payday),
    floorBps: a.floorBps,
    funded: big(a.funded),
    withdrawn: big(a.withdrawn),
    endTs: a.endTs === null ? null : num(a.endTs),
    adjustment: big(a.adjustment),
    adjustmentReason: a.adjustmentReason,
    adjustmentAccepted: a.adjustmentAccepted,
    status: Object.keys(a.status)[0] as StreamStatus,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchEmployer(
  program: DniowkaProgram,
  authority: PublicKey,
): Promise<EmployerView | null> {
  const address = employerPda(authority);
  const a = await program.account.employer.fetchNullable(address);
  return a ? toEmployer(address, a) : null;
}

export async function fetchEmployerAt(
  program: DniowkaProgram,
  address: PublicKey,
): Promise<EmployerView | null> {
  const a = await program.account.employer.fetchNullable(address);
  return a ? toEmployer(address, a) : null;
}

/** All streams of an employer, newest first (ids 0..stream_count). */
export async function fetchStreams(
  program: DniowkaProgram,
  employer: EmployerView,
): Promise<StreamView[]> {
  const addresses: PublicKey[] = [];
  for (let id = employer.streamCount - 1n; id >= 0n; id--) {
    addresses.push(streamPda(employer.address, id));
  }
  if (addresses.length === 0) return [];
  const accounts = await program.account.stream.fetchMultiple(addresses);
  return accounts.flatMap((a, i) => (a ? [toStream(addresses[i], a)] : []));
}

function clockTime(data: Buffer): number {
  // Clock sysvar: slot u64, epoch_start_timestamp i64, epoch u64, leader_schedule_epoch u64,
  // unix_timestamp i64 at offset 32.
  return Number(data.readBigInt64LE(32));
}

/** The stream and the cluster clock in one request. */
export async function fetchStreamAndNow(
  program: DniowkaProgram,
  address: PublicKey,
): Promise<{ stream: StreamView | null; now: number }> {
  const [account, clock] = await program.provider.connection.getMultipleAccountsInfo(
    [address, SYSVAR_CLOCK_PUBKEY],
    "confirmed",
  );
  if (!clock) throw new Error("cannot read the cluster clock");
  const stream =
    account && account.owner.equals(program.programId)
      ? toStream(address, program.coder.accounts.decode("stream", account.data))
      : null;
  return { stream, now: clockTime(clock.data) };
}

export async function clusterNow(connection: Connection): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  if (!clock) throw new Error("cannot read the cluster clock");
  return clockTime(clock.data);
}

const U64_MAX = 18_446_744_073_709_551_615n;
// Any valid-looking blockhash: the RPC replaces it (replaceRecentBlockhash).
const PLACEHOLDER_BLOCKHASH = "11111111111111111111111111111111";

/**
 * Earned and available as the program computes them right now: simulate an impossible
 * withdrawal (no signature needed) and read the program's `earned X available Y` log line.
 * Fee payer is the employer's wallet, which holds SOL; nothing is sent.
 */
export async function programEarned(
  program: DniowkaProgram,
  stream: StreamView,
  employerAuthority: PublicKey,
): Promise<{ earned: bigint; available: bigint } | null> {
  if (stream.status !== "active") return null;
  const ix = await withdrawEarnedIx(
    program,
    employerAuthority,
    stream.employee,
    stream.address,
    stream.mint,
    U64_MAX,
  );
  return parseEarnedAvailable(await simulatedLogs(program, employerAuthority, ix));
}

/**
 * How far a payday adjustment can go, as the program computes it: simulate an impossible
 * proposal (as the employer, unsigned) and read its `cut cap X with consent Y` log line.
 * Null when no adjustment can be proposed (not running, or payday has come).
 */
export async function programCutCaps(
  program: DniowkaProgram,
  stream: StreamView,
  employerAuthority: PublicKey,
): Promise<CutCaps | null> {
  if (stream.status !== "active") return null;
  const ix = await proposeAdjustmentIx(program, employerAuthority, stream.address, U64_MAX, 4);
  return parseCutCaps(await simulatedLogs(program, employerAuthority, ix));
}

/** Logs of a simulated, unsigned transaction; fee payer = the employer's wallet. */
async function simulatedLogs(
  program: DniowkaProgram,
  employerAuthority: PublicKey,
  ix: TransactionInstruction,
): Promise<string[] | null> {
  const message = new TransactionMessage({
    payerKey: employerAuthority,
    recentBlockhash: PLACEHOLDER_BLOCKHASH,
    instructions: [ix],
  }).compileToV0Message();
  const { value } = await program.provider.connection.simulateTransaction(
    new VersionedTransaction(message),
    { sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" },
  );
  return value.logs;
}

/** zł balance of a wallet, in grosze (0 if it has no zł account yet). */
export async function zlBalance(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
): Promise<bigint> {
  const account = zlAccount(mint, owner);
  try {
    const { value } = await connection.getTokenAccountBalance(account, "confirmed");
    return BigInt(value.amount);
  } catch {
    return 0n; // account not created yet
  }
}

export type Settlement = {
  signature: string;
  payEmployee: bigint;
  refundEmployer: bigint;
  shortfall: bigint;
  earnedFinal: bigint;
  cut: bigint;
};

/** The payday receipt, read from the program's own `Settled` event. */
export async function fetchSettlement(
  program: DniowkaProgram,
  stream: PublicKey,
): Promise<Settlement | null> {
  const connection = program.provider.connection;
  const signatures = await connection.getSignaturesForAddress(stream, { limit: 20 }, "confirmed");
  const parser = new EventParser(program.programId, program.coder);
  for (const s of signatures) {
    if (s.err) continue;
    const tx = await connection.getTransaction(s.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    for (const event of parser.parseLogs(tx?.meta?.logMessages ?? [])) {
      if (event.name !== "settled") continue;
      const d = event.data as Record<string, BNLike>;
      return {
        signature: s.signature,
        payEmployee: big(d.payEmployee),
        refundEmployer: big(d.refundEmp),
        shortfall: big(d.shortfall),
        earnedFinal: big(d.earnedFinal),
        cut: big(d.cut),
      };
    }
  }
  return null;
}
