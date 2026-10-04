/**
 * Devnet smoke run of the deployed program, in real time (a 90-second "month").
 *
 *   pnpm run smoke
 *
 * The dev wallet (ANCHOR_WALLET, default ~/.config/solana/id.json) is the employer,
 * pays every fee and rent, and triggers payday. The employee is a fresh wallet with
 * 0 SOL. Re-runnable: the employer account and its zł mint are reused if they exist.
 * "Now" always comes from the cluster clock, never the laptop clock.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import type { Dniowka } from "../target/types/dniowka";

const RPC = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
const WALLET = process.env.ANCHOR_WALLET ?? `${homedir()}/.config/solana/id.json`;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const NET = 600_000; // 6 000,00 zł
const FLOOR_BPS = 7_000;
const PERIOD_SECONDS = 90;
const TAKE = 100_000; // 1 000,00 zł, within the floor once a third of the period has passed
const TOO_MUCH = 500_000; // 5 000,00 zł, never available before payday

const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const zl = (grosze: number | bigint) =>
  `${(Number(grosze) / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;

const connection = new Connection(RPC, "confirmed");
const boss = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8")) as number[]),
);
const provider = new AnchorProvider(connection, new Wallet(boss), {
  commitment: "confirmed",
});
const idl = JSON.parse(readFileSync("target/idl/dniowka.json", "utf8")) as Dniowka;
const program = new Program<Dniowka>(idl, provider);
const pda = (...seeds: Buffer[]) =>
  PublicKey.findProgramAddressSync(seeds, program.programId)[0];

async function clusterTime(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  if (!clock) throw new Error("cannot read the Clock sysvar");
  return Number(clock.data.readBigInt64LE(32));
}

async function waitUntil(ts: number, label: string) {
  for (;;) {
    const now = await clusterTime();
    if (now >= ts) return;
    process.stdout.write(`\r  waiting for ${label}: ${ts - now}s (cluster clock)   `);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

/** The dev wallet pays the fee; `others` co-sign. */
async function send(step: string, ixs: TransactionInstruction[], others: Keypair[] = []) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = boss.publicKey;
  const sig = await sendAndConfirmTransaction(connection, tx, [boss, ...others], {
    commitment: "confirmed",
  });
  console.log(`\n✔ ${step}\n  ${explorer(sig)}`);
  return sig;
}

async function main() {
  console.log(`program ${program.programId.toBase58()} on ${RPC}`);
  const employer = pda(Buffer.from("employer"), boss.publicKey.toBuffer());

  // 1. Employer and its clean zł mint (Token-2022, 2 decimals, no freeze authority).
  let mint: PublicKey;
  const existing = await program.account.employer.fetchNullable(employer);
  if (existing) {
    mint = existing.mint;
    console.log(`reusing employer ${employer.toBase58()} and mint ${mint.toBase58()}`);
  } else {
    mint = await createMint(connection, boss, boss.publicKey, null, 2, undefined, undefined, TOKEN_2022_PROGRAM_ID);
    console.log(`created zł mint ${mint.toBase58()}`);
    await send("init_employer", [
      await program.methods
        .initEmployer(FLOOR_BPS)
        .accountsPartial({ payer: boss.publicKey, authority: boss.publicKey, employer, mint })
        .instruction(),
    ]);
  }
  const source = await getOrCreateAssociatedTokenAccount(
    connection, boss, mint, boss.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID,
  );
  if (source.amount < BigInt(NET)) {
    await mintTo(connection, boss, mint, source.address, boss, NET, [], undefined, TOKEN_2022_PROGRAM_ID);
    console.log(`minted ${zl(NET)} of test zł to the employer`);
  }

  // 2. A 90-second "month" for a fresh employee who holds no SOL at all.
  const employee = Keypair.generate();
  const start = (await clusterTime()) - 5;
  const end = start + PERIOD_SECONDS;
  const { streamCount } = await program.account.employer.fetch(employer);
  const stream = pda(Buffer.from("stream"), employer.toBuffer(), streamCount.toArrayLike(Buffer, "le", 8));
  const vault = pda(Buffer.from("vault"), stream.toBuffer());
  console.log(`employee ${employee.publicKey.toBase58()} (0 SOL)\nstream ${stream.toBase58()}`);

  await send("create_stream (hinted invite, 6 000,00 zł, 90 s)", [
    await program.methods
      .createStream(employee.publicKey, new BN(NET), new BN(start), new BN(end), new BN(end), FLOOR_BPS)
      .accountsPartial({
        payer: boss.publicKey, authority: boss.publicKey, employer, stream, vault, mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction(),
  ]);
  await send("fund_stream 6 000,00 zł", [
    await program.methods
      .fundStream(new BN(NET))
      .accountsPartial({
        authority: boss.publicKey, employer, stream, vault, mint, source: source.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction(),
  ]);
  await send(
    "accept_stream (employee signs, employer pays the fee)",
    [
      await program.methods
        .acceptStream(Array(32).fill(0))
        .accountsPartial({ employee: employee.publicKey, stream, employer })
        .instruction(),
    ],
    [employee],
  );

  // 3. Take earned money, then try to take more than was earned.
  const withdraw = (amount: number) =>
    program.methods
      .withdrawEarned(new BN(amount))
      .accountsPartial({
        payer: boss.publicKey, employee: employee.publicKey, stream, vault, mint,
        destination: getAssociatedTokenAddressSync(mint, employee.publicKey, false, TOKEN_2022_PROGRAM_ID),
        tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

  await waitUntil(start + PERIOD_SECONDS / 3, "a third of the period");
  await send(`withdraw_earned ${zl(TAKE)}`, [await withdraw(TAKE)], [employee]);

  // Sent without preflight so the program itself refuses it on-chain.
  const over = new Transaction().add(await withdraw(TOO_MUCH));
  over.feePayer = boss.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  over.recentBlockhash = blockhash;
  over.sign(boss, employee);
  const overSig = await connection.sendRawTransaction(over.serialize(), { skipPreflight: true });
  await connection.confirmTransaction({ signature: overSig, blockhash, lastValidBlockHeight }, "confirmed");
  const failed = await connection.getTransaction(overSig, {
    commitment: "confirmed", maxSupportedTransactionVersion: 0,
  });
  const reason = failed?.meta?.logMessages?.find((l) => l.includes("Error Code"));
  if (!failed?.meta?.err || !reason?.includes("ExceedsAvailable")) {
    throw new Error(`over-withdrawal was not refused as ExceedsAvailable: ${JSON.stringify(failed?.meta?.err)}`);
  }
  console.log(`\n✘ withdraw_earned ${zl(TOO_MUCH)} refused on-chain (expected)\n  ${reason}\n  ${explorer(overSig)}`);

  // 4. Payday: anyone may trigger it; here the dev wallet does.
  await waitUntil(end, "payday");
  await send("settle (payday)", [
    await program.methods
      .settle()
      .accountsPartial({
        payer: boss.publicKey, stream, employer, employee: employee.publicKey,
        employerAuthority: boss.publicKey, vault, mint,
        employeeToken: getAssociatedTokenAddressSync(mint, employee.publicKey, false, TOKEN_2022_PROGRAM_ID),
        employerToken: source.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .instruction(),
  ]);

  const paid = await getAccount(
    connection,
    getAssociatedTokenAddressSync(mint, employee.publicKey, false, TOKEN_2022_PROGRAM_ID),
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );
  const left = await getAccount(connection, vault, "confirmed", TOKEN_2022_PROGRAM_ID);
  const s = await program.account.stream.fetch(stream);
  console.log(
    `\nemployee received ${zl(paid.amount)} in total · vault holds ${zl(left.amount)} · status ${Object.keys(s.status)[0]}`,
  );
  if (paid.amount !== BigInt(NET) || left.amount !== 0n) throw new Error("unexpected final balances");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
