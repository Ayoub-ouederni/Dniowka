/**
 * The Anchor client for the deployed program: PDAs and one builder per instruction.
 * Builders only assemble instructions; every rule is checked by the program itself.
 */
import { BN, Program, type Provider } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";

import { MEMO_PROGRAM_ID, PROGRAM_ID } from "./config";
import type { Dniowka } from "./idl/dniowka";
import idl from "./idl/dniowka.json";

export type DniowkaProgram = Program<Dniowka>;

export function makeProgram(connection: Connection): DniowkaProgram {
  // No wallet: the app only reads and builds instructions; the wallet signs separately.
  return new Program<Dniowka>(idl as Dniowka, { connection } as Provider);
}

const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const employerPda = (authority: PublicKey) =>
  pda(Buffer.from("employer"), authority.toBuffer());

export const streamPda = (employer: PublicKey, id: bigint) => {
  const le = Buffer.alloc(8);
  le.writeBigUInt64LE(id);
  return pda(Buffer.from("stream"), employer.toBuffer(), le);
};

export const vaultPda = (stream: PublicKey) => pda(Buffer.from("vault"), stream.toBuffer());

/** The zł account a wallet receives into (Token-2022 associated account). */
export const zlAccount = (mint: PublicKey, owner: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID);

const bn = (v: bigint | number) => new BN(v.toString());

export function initEmployerIx(
  program: DniowkaProgram,
  authority: PublicKey,
  mint: PublicKey,
  defaultFloorBps: number,
): Promise<TransactionInstruction> {
  return program.methods
    .initEmployer(defaultFloorBps)
    .accountsPartial({
      payer: authority,
      authority,
      employer: employerPda(authority),
      mint,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export type NewStream = {
  employeeHint: PublicKey | null;
  net: bigint;
  periodStart: number;
  periodEnd: number;
  payday: number;
  floorBps: number;
};

export function createStreamIx(
  program: DniowkaProgram,
  authority: PublicKey,
  mint: PublicKey,
  nextId: bigint,
  s: NewStream,
): Promise<TransactionInstruction> {
  const employer = employerPda(authority);
  const stream = streamPda(employer, nextId);
  return program.methods
    .createStream(
      s.employeeHint,
      bn(s.net),
      bn(s.periodStart),
      bn(s.periodEnd),
      bn(s.payday),
      s.floorBps,
    )
    .accountsPartial({
      payer: authority,
      authority,
      employer,
      stream,
      vault: vaultPda(stream),
      mint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function fundStreamIx(
  program: DniowkaProgram,
  authority: PublicKey,
  stream: PublicKey,
  mint: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  return program.methods
    .fundStream(bn(amount))
    .accountsPartial({
      authority,
      employer: employerPda(authority),
      stream,
      vault: vaultPda(stream),
      mint,
      source: zlAccount(mint, authority),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .instruction();
}

export function acceptStreamIx(
  program: DniowkaProgram,
  employee: PublicKey,
  stream: PublicKey,
  employer: PublicKey,
): Promise<TransactionInstruction> {
  // The income commitment is a placeholder until the ZK proof lands (M6).
  return program.methods
    .acceptStream(Array(32).fill(0))
    .accountsPartial({ employee, stream, employer })
    .instruction();
}

/** `payer` pays rent if the employee's zł account doesn't exist yet. */
export function withdrawEarnedIx(
  program: DniowkaProgram,
  payer: PublicKey,
  employee: PublicKey,
  stream: PublicKey,
  mint: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  return program.methods
    .withdrawEarned(bn(amount))
    .accountsPartial({
      payer,
      employee,
      stream,
      vault: vaultPda(stream),
      mint,
      destination: zlAccount(mint, employee),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

/** Payday. Anyone may send it; `payer` is whoever presses the button. */
export function settleIx(
  program: DniowkaProgram,
  payer: PublicKey,
  stream: PublicKey,
  employer: PublicKey,
  employee: PublicKey,
  employerAuthority: PublicKey,
  mint: PublicKey,
): Promise<TransactionInstruction> {
  return program.methods
    .settle()
    .accountsPartial({
      payer,
      stream,
      employer,
      employee,
      employerAuthority,
      vault: vaultPda(stream),
      mint,
      employeeToken: zlAccount(mint, employee),
      employerToken: zlAccount(mint, employerAuthority),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export function endEmploymentIx(
  program: DniowkaProgram,
  authority: PublicKey,
  stream: PublicKey,
  endTs: number,
): Promise<TransactionInstruction> {
  return program.methods
    .endEmployment(bn(endTs))
    .accountsPartial({ authority, employer: employerPda(authority), stream })
    .instruction();
}

/** Reason codes as the program stores them. */
export const ADJUSTMENT_REASONS = [1, 2, 3, 4] as const;

export function proposeAdjustmentIx(
  program: DniowkaProgram,
  authority: PublicKey,
  stream: PublicKey,
  amount: bigint,
  reason: number,
): Promise<TransactionInstruction> {
  return program.methods
    .proposeAdjustment(bn(amount), reason)
    .accountsPartial({ authority, employer: employerPda(authority), stream })
    .instruction();
}

/** `amount` is the adjustment the employee reviewed; the program refuses if it changed. */
export function acceptAdjustmentIx(
  program: DniowkaProgram,
  employee: PublicKey,
  stream: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  return program.methods
    .acceptAdjustment(bn(amount))
    .accountsPartial({ employee, stream })
    .instruction();
}

export function cancelUnacceptedIx(
  program: DniowkaProgram,
  authority: PublicKey,
  stream: PublicKey,
  mint: PublicKey,
): Promise<TransactionInstruction> {
  return program.methods
    .cancelUnaccepted()
    .accountsPartial({
      authority,
      employer: employerPda(authority),
      stream,
      vault: vaultPda(stream),
      mint,
      employerToken: zlAccount(mint, authority),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
