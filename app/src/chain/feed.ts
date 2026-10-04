/**
 * The big screen's live receipt: the program's own events (and on-chain refusals), read
 * back from recent transactions. Reading and displaying only; nothing here decides anything.
 */
import { EventParser } from "@anchor-lang/core";
import type { ConfirmedSignatureInfo, Connection } from "@solana/web3.js";

import { parseCancelFrom, parseEarnedAvailable, parseProgramError } from "./errors";
import type { DniowkaProgram } from "./program";

type Base = { signature: string; time: number | null; stream: string };

export type FeedEntry = Base &
  (
    | { kind: "created"; net: bigint }
    | { kind: "funded"; amount: bigint }
    | { kind: "joined" }
    | { kind: "took"; amount: bigint }
    | { kind: "ended"; endTs: number }
    | { kind: "proposed"; amount: bigint; reason: number }
    | { kind: "accepted"; amount: bigint }
    | { kind: "paid"; pay: bigint; refund: bigint; cut: bigint }
    | { kind: "shortfall"; amount: bigint }
    | { kind: "cancelled"; refund: bigint }
    | {
        kind: "refused";
        error: string;
        earned?: bigint;
        available?: bigint;
        cancelFrom?: number;
      }
  );

type BNLike = { toString(): string };
const big = (v: unknown) => BigInt((v as BNLike).toString());
const key = (v: unknown) => (v as BNLike).toString();

/* eslint-disable @typescript-eslint/no-explicit-any -- Anchor's decoded event shapes */
function fromEvent(name: string, d: any, base: Omit<Base, "stream">): FeedEntry | null {
  const b = { ...base, stream: key(d.stream) };
  switch (name) {
    case "streamCreated":
      return { ...b, kind: "created", net: big(d.netAmount) };
    case "funded":
      return { ...b, kind: "funded", amount: big(d.amount) };
    case "streamAccepted":
      return { ...b, kind: "joined" };
    case "withdrawn":
      return { ...b, kind: "took", amount: big(d.amount) };
    case "employmentEnded":
      return { ...b, kind: "ended", endTs: Number(big(d.endTs)) };
    case "adjustmentProposed":
      return { ...b, kind: "proposed", amount: big(d.amount), reason: d.reason };
    case "adjustmentAccepted":
      return { ...b, kind: "accepted", amount: big(d.amount) };
    case "settled":
      return {
        ...b,
        kind: "paid",
        pay: big(d.payEmployee),
        refund: big(d.refundEmp),
        cut: big(d.cut),
      };
    case "wageShortfall":
      return { ...b, kind: "shortfall", amount: big(d.shortfall) };
    case "streamCancelled":
      return { ...b, kind: "cancelled", refund: big(d.refundEmp) };
    default:
      return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Feed entries of one transaction. A successful one yields its events; a refused one yields
 * one "refused" entry for the first watched account it touched (failed transactions emit no
 * events, so the account list is the only link to a salary).
 */
export function parseFeedTx(
  program: DniowkaProgram,
  tx: {
    signature: string;
    time: number | null;
    logs: string[];
    failed: boolean;
    accounts: string[];
  },
  isWatched: (stream: string) => boolean,
): FeedEntry[] {
  const base = { signature: tx.signature, time: tx.time };
  if (tx.failed) {
    const error = parseProgramError(tx.logs);
    const stream = tx.accounts.find(isWatched);
    if (!error || !stream) return [];
    const numbers = parseEarnedAvailable(tx.logs);
    const cancelFrom = parseCancelFrom(tx.logs);
    return [
      {
        ...base,
        stream,
        kind: "refused",
        error: error.name,
        ...(numbers ?? {}),
        ...(cancelFrom !== null ? { cancelFrom } : {}),
      },
    ];
  }
  const parser = new EventParser(program.programId, program.coder);
  const entries: FeedEntry[] = [];
  for (const event of parser.parseLogs(tx.logs)) {
    const entry = fromEvent(event.name, event.data, base);
    if (entry && isWatched(entry.stream)) entries.push(entry);
  }
  return entries;
}

type TxSummary = Parameters<typeof parseFeedTx>[1];

/**
 * Keeps the newest program transactions, fetching each one only once and parsing them on
 * every refresh (so a salary created after a read still shows its history). Newest first.
 */
export class FeedReader {
  private seen = new Map<string, TxSummary>();
  private program: DniowkaProgram;
  private limit: number;
  private perRefresh: number;

  /**
   * `perRefresh` caps how many unseen transactions are read per call, one at a time: the
   * public devnet endpoint rate-limits bursts, so the receipt fills in over a few refreshes.
   */
  constructor(program: DniowkaProgram, limit = 25, perRefresh = 6) {
    this.program = program;
    this.limit = limit;
    this.perRefresh = perRefresh;
  }

  async refresh(isWatched: (stream: string) => boolean): Promise<FeedEntry[]> {
    const connection: Connection = this.program.provider.connection;
    const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
      this.program.programId,
      { limit: this.limit },
      "confirmed",
    );
    const fresh = signatures.filter((s) => !this.seen.has(s.signature)).slice(0, this.perRefresh);
    for (const s of fresh) {
      try {
        const tx = await connection.getTransaction(s.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta) continue; // not readable yet; retried on the next refresh
        this.seen.set(s.signature, {
          signature: s.signature,
          time: tx.blockTime ?? s.blockTime ?? null,
          logs: tx.meta.logMessages ?? [],
          failed: tx.meta.err !== null,
          accounts: tx.transaction.message.staticAccountKeys.map((k) => k.toBase58()),
        });
      } catch {
        break; // rate-limited: keep what we have, continue next refresh
      }
    }
    return signatures.flatMap((s) => {
      const tx = this.seen.get(s.signature);
      return tx ? parseFeedTx(this.program, tx, isWatched) : [];
    });
  }
}
