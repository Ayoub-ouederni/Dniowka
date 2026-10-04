/**
 * Sending. Normal actions go through the wallet's own send. "Try anyway" asks the wallet to
 * sign only and broadcasts without preflight, so the program itself refuses on-chain and
 * the failed transaction is visible on Explorer.
 */
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { type Connection, Transaction, type TransactionInstruction } from "@solana/web3.js";

import { type Failure, classifyFailure } from "./errors";

export type Signer = Pick<WalletContextState, "publicKey" | "sendTransaction" | "signTransaction">;

export type TxOutcome =
  | { ok: true; signature: string }
  /** `signature` is set when the refusal happened on-chain (there is a proof link). */
  | { ok: false; signature: string | null; failure: Failure };

/** Wallet Adapter wraps the original error in `.error`; prefer whichever says more. */
function describe(e: unknown): Failure {
  const inner = e && typeof e === "object" ? (e as { error?: unknown }).error : undefined;
  if (inner) {
    const f = classifyFailure(inner);
    if (f.kind !== "unknown") return f;
  }
  return classifyFailure(e);
}

async function build(connection: Connection, signer: Signer, ixs: TransactionInstruction[]) {
  if (!signer.publicKey) throw new Error("not connected");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: signer.publicKey, blockhash, lastValidBlockHeight }).add(
    ...ixs,
  );
  return { tx, blockhash, lastValidBlockHeight };
}

async function failedLogs(connection: Connection, signature: string): Promise<string[]> {
  // The transaction can take a moment to become readable after confirmation.
  for (let i = 0; i < 5; i++) {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (tx?.meta) return tx.meta.logMessages ?? [];
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return [];
}

async function settleOutcome(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<TxOutcome> {
  try {
    const { value } = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    if (!value.err) return { ok: true, signature };
    const logs = await failedLogs(connection, signature);
    return { ok: false, signature, failure: classifyFailure({ err: value.err, logs }) };
  } catch (e) {
    const logs = isInstructionError(e) ? await failedLogs(connection, signature) : [];
    return { ok: false, signature, failure: confirmThrown(e, logs) };
  }
}

/**
 * When the transaction has already landed by the time we start waiting, `confirmTransaction`
 * throws the bare transaction error (`{InstructionError: [i, {Custom: n}]}`) instead of
 * returning it, so a fast on-chain refusal would read as "something went wrong".
 */
function isInstructionError(e: unknown): boolean {
  return !!e && typeof e === "object" && "InstructionError" in e;
}

export function confirmThrown(e: unknown, logs: string[]): Failure {
  return isInstructionError(e) ? classifyFailure({ err: e, logs }) : describe(e);
}

export async function sendNormal(
  connection: Connection,
  signer: Signer,
  ixs: TransactionInstruction[],
): Promise<TxOutcome> {
  let signature: string;
  let built: Awaited<ReturnType<typeof build>>;
  try {
    built = await build(connection, signer, ixs);
    signature = await signer.sendTransaction(built.tx, connection, {
      preflightCommitment: "confirmed",
    });
  } catch (e) {
    return { ok: false, signature: null, failure: describe(e) };
  }
  return settleOutcome(connection, signature, built.blockhash, built.lastValidBlockHeight);
}

export async function sendTryAnyway(
  connection: Connection,
  signer: Signer,
  ixs: TransactionInstruction[],
): Promise<TxOutcome> {
  let signature: string;
  let built: Awaited<ReturnType<typeof build>>;
  try {
    if (!signer.signTransaction) throw new Error("this app cannot sign without sending");
    built = await build(connection, signer, ixs);
    const signed = await signer.signTransaction(built.tx);
    signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
  } catch (e) {
    return { ok: false, signature: null, failure: describe(e) };
  }
  return settleOutcome(connection, signature, built.blockhash, built.lastValidBlockHeight);
}
