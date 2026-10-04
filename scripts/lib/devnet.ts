/**
 * Shared by the demo scripts. The dev wallet (ANCHOR_WALLET, default ~/.config/solana/id.json)
 * is the employer and pays every fee and rent; its key is loaded, never printed.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import { AnchorProvider, BN, Program, Wallet, utils } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

import type { Dniowka } from "../../target/types/dniowka";

export const RPC = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
const WALLET = process.env.ANCHOR_WALLET ?? `${homedir()}/.config/solana/id.json`;
export const APP = process.env.APP_URL ?? "http://localhost:5180";
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const zl = (grosze: number | bigint) =>
  `${(Number(grosze) / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;

export const connection = new Connection(RPC, "confirmed");
export const boss = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8")) as number[]),
);
export const program = new Program<Dniowka>(
  JSON.parse(readFileSync("target/idl/dniowka.json", "utf8")) as Dniowka,
  new AnchorProvider(connection, new Wallet(boss), { commitment: "confirmed" }),
);

export const pda = (...seeds: Buffer[]) =>
  PublicKey.findProgramAddressSync(seeds, program.programId)[0];
export const ata = (mint: PublicKey, owner: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
export const employerPda = pda(Buffer.from("employer"), boss.publicKey.toBuffer());
export const streamAt = (id: BN | bigint | number) =>
  pda(
    Buffer.from("stream"),
    employerPda.toBuffer(),
    new BN(id.toString()).toArrayLike(Buffer, "le", 8),
  );
export const vaultOf = (stream: PublicKey) => pda(Buffer.from("vault"), stream.toBuffer());

const bs58 = utils.bytes.bs58;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries a read a few times: the public endpoint answers 429 to bursts. */
export async function retry<T>(read: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await read();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1_500 * i);
    }
  }
}

export async function clusterTime(): Promise<number> {
  const clock = await retry(() => connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed"));
  if (!clock) throw new Error("cannot read the Clock sysvar");
  return Number(clock.data.readBigInt64LE(32));
}

export async function waitUntil(ts: number, label: string) {
  for (;;) {
    const now = await clusterTime().catch(() => null);
    if (now !== null && now >= ts) return process.stdout.write("\n");
    if (now !== null)
      process.stdout.write(`\r  waiting for ${label}: ${ts - now}s (cluster clock)   `);
    await sleep(4_000);
  }
}

/**
 * The dev wallet pays the fee; `others` co-sign. Rate limits (429) are retried only until the
 * transaction is accepted by the node; after that it is never re-sent (no double action), we
 * only poll its status.
 */
export async function send(step: string, ixs: TransactionInstruction[], others: Keypair[] = []) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = boss.publicKey;
  const { blockhash, lastValidBlockHeight } = await retry(() =>
    connection.getLatestBlockhash("confirmed"),
  );
  tx.recentBlockhash = blockhash;
  tx.sign(boss, ...others);
  const raw = tx.serialize();
  const sig = bs58.encode(tx.signature!);
  await retry(
    () =>
      connection.sendRawTransaction(raw, { maxRetries: 5 }).catch((e: unknown) => {
        // An earlier attempt landed and only its reply was lost: it is sent.
        if (/already been processed/i.test(String(e))) return sig;
        throw e;
      }),
    8,
  );
  for (;;) {
    const status = await connection
      .getSignatureStatuses([sig])
      .then((r) => r.value[0])
      .catch(() => null); // 429 while polling: just poll again
    if (status?.err) throw new Error(`${step} failed on-chain: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized")
      break;
    const height = await connection.getBlockHeight("confirmed").catch(() => 0);
    if (height > lastValidBlockHeight) {
      // Status reads may all have hit 429: look it up once more before calling it lost.
      const last = await retry(() =>
        connection.getSignatureStatuses([sig], { searchTransactionHistory: true }),
      ).then((r) => r.value[0]);
      if (last && !last.err) break;
      throw new Error(`${step}: expired before confirmation`);
    }
    await sleep(1_500);
  }
  console.log(`✔ ${step}\n  ${explorer(sig)}`);
  await sleep(800); // spread requests: the public endpoint rate-limits bursts
  return sig;
}

export type StreamAccount = Awaited<ReturnType<typeof program.account.stream.fetch>>;
export const statusOf = (s: StreamAccount) =>
  Object.keys(s.status)[0] as "invited" | "active" | "settled" | "cancelled";

/** Payday, sent by the dev wallet as the "anyone" caller (it pays fee and rent). */
export function settleIx(stream: PublicKey, s: StreamAccount) {
  return program.methods
    .settle()
    .accountsPartial({
      payer: boss.publicKey,
      stream,
      employer: s.employer,
      employee: s.employee,
      employerAuthority: boss.publicKey,
      vault: s.vault,
      mint: s.mint,
      employeeToken: ata(s.mint, s.employee),
      employerToken: ata(s.mint, boss.publicKey),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function cancelIx(stream: PublicKey, s: StreamAccount) {
  return program.methods
    .cancelUnaccepted()
    .accountsPartial({
      authority: boss.publicKey,
      employer: s.employer,
      stream,
      vault: s.vault,
      mint: s.mint,
      employerToken: ata(s.mint, boss.publicKey),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
