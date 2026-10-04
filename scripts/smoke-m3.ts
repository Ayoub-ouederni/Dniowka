/**
 * Devnet run of the M3 rules, in real time (a 120-second "month").
 *
 *   pnpm run smoke:m3
 *
 * Like `smoke`: the dev wallet (ANCHOR_WALLET) is the employer and pays every fee; the
 * employee and the payday caller are fresh wallets with 0 SOL. Refusals are sent without
 * preflight so the program itself refuses them on-chain (failed transactions on Explorer).
 * Leaves its salaries on devnet so the app's screens can show them (URLs printed at the end).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
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
const APP = process.env.APP_URL ?? "http://localhost:5180";
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const NET = 600_000; // 6 000,00 zł
const FLOOR_BPS = 7_000;
const PERIOD = 120;
const END_AT = 100; // employment ends 100 s into the month: earned_final 5 000,00 zł
const TAKE = 100_000; // 1 000,00 zł
const FIRST_CUT = 200_000; // above the 1 500,00 zł the employer may cut alone
const SECOND_CUT = 250_000;
const INVITE_FUNDING = 100_000;
/** Seconds to hold with a proposal pending (to look at the app meanwhile); default none. */
const PAUSE = Number(process.env.PAUSE ?? "0");

const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const zl = (grosze: number | bigint) =>
  `${(Number(grosze) / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;

const connection = new Connection(RPC, "confirmed");
const boss = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8")) as number[]),
);
const program = new Program<Dniowka>(
  JSON.parse(readFileSync("target/idl/dniowka.json", "utf8")) as Dniowka,
  new AnchorProvider(connection, new Wallet(boss), { commitment: "confirmed" }),
);
const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
const ata = (mint: PublicKey, owner: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);

async function clusterTime(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
  if (!clock) throw new Error("cannot read the Clock sysvar");
  return Number(clock.data.readBigInt64LE(32));
}

async function waitUntil(ts: number, label: string) {
  for (;;) {
    // The public endpoint rate-limits; a missed read just waits for the next one.
    const now = await clusterTime().catch(() => null);
    if (now !== null && now >= ts) return process.stdout.write("\n");
    if (now !== null) process.stdout.write(`\r  waiting for ${label}: ${ts - now}s (cluster clock)   `);
    await new Promise((r) => setTimeout(r, 4_000));
  }
}

/** The dev wallet pays the fee; `others` co-sign. */
async function send(step: string, ixs: TransactionInstruction[], others: Keypair[] = []) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = boss.publicKey;
  const sig = await sendAndConfirmTransaction(connection, tx, [boss, ...others], {
    commitment: "confirmed",
  });
  console.log(`✔ ${step}\n  ${explorer(sig)}`);
  return sig;
}

/** Sent without preflight; must be refused on-chain with exactly `expected`. */
async function refused(
  step: string,
  expected: string,
  ixs: TransactionInstruction[],
  others: Keypair[] = [],
) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = boss.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(boss, ...others);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  // Some web3.js paths throw the on-chain error instead of returning it: both mean "landed".
  await connection
    .confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed")
    .catch(() => undefined);
  let reason: string | undefined;
  for (let i = 0; i < 5 && !reason; i++) {
    const t = await connection.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (t?.meta) {
      if (!t.meta.err) throw new Error(`${step}: expected a refusal, it succeeded`);
      reason = t.meta.logMessages?.find((l) => l.includes("Error Code")) ?? "(no error log)";
    } else await new Promise((r) => setTimeout(r, 1_000));
  }
  if (!reason?.includes(`Error Code: ${expected}.`)) {
    throw new Error(`${step}: expected ${expected}, got ${reason}`);
  }
  console.log(`✘ ${step} refused on-chain (expected ${expected})\n  ${explorer(sig)}`);
  return sig;
}

async function main() {
  console.log(`program ${program.programId.toBase58()} on ${RPC}`);
  const employer = pda(Buffer.from("employer"), boss.publicKey.toBuffer());
  const existing = await program.account.employer.fetchNullable(employer);
  if (!existing) throw new Error("run `pnpm run smoke` once first (it registers the employer)");
  const mint = existing.mint;
  const source = await getOrCreateAssociatedTokenAccount(
    connection, boss, mint, boss.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID,
  );
  if (source.amount < BigInt(NET + INVITE_FUNDING)) {
    await mintTo(connection, boss, mint, source.address, boss, NET + INVITE_FUNDING, [], undefined, TOKEN_2022_PROGRAM_ID);
    console.log(`minted ${zl(NET + INVITE_FUNDING)} of test zł to the employer`);
  }

  const employee = Keypair.generate();
  const anyone = Keypair.generate();
  const start = (await clusterTime()) - 5;
  const end = start + PERIOD;

  let { streamCount } = await program.account.employer.fetch(employer);
  const streamAt = (id: BN) => pda(Buffer.from("stream"), employer.toBuffer(), id.toArrayLike(Buffer, "le", 8));
  const stream = streamAt(streamCount);
  const invite = streamAt(streamCount.addn(1));
  const vaultOf = (s: PublicKey) => pda(Buffer.from("vault"), s.toBuffer());
  const vault = vaultOf(stream);
  console.log(`employee ${employee.publicKey.toBase58()} (0 SOL)\nsalary ${stream.toBase58()}\ninvite ${invite.toBase58()}\n`);

  const create = (s: PublicKey, hint: PublicKey) =>
    program.methods
      .createStream(hint, new BN(NET), new BN(start), new BN(end), new BN(end), FLOOR_BPS)
      .accountsPartial({
        payer: boss.publicKey, authority: boss.publicKey, employer, stream: s, vault: vaultOf(s), mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  const fund = (s: PublicKey, amount: number) =>
    program.methods
      .fundStream(new BN(amount))
      .accountsPartial({
        authority: boss.publicKey, employer, stream: s, vault: vaultOf(s), mint, source: source.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  const endAt = (ts: number) =>
    program.methods
      .endEmployment(new BN(ts))
      .accountsPartial({ authority: boss.publicKey, employer, stream })
      .instruction();
  const propose = (amount: number, reason: number) =>
    program.methods
      .proposeAdjustment(new BN(amount), reason)
      .accountsPartial({ authority: boss.publicKey, employer, stream })
      .instruction();
  const accept = (amount: number) =>
    program.methods
      .acceptAdjustment(new BN(amount))
      .accountsPartial({ employee: employee.publicKey, stream })
      .instruction();
  const cancel = () =>
    program.methods
      .cancelUnaccepted()
      .accountsPartial({
        authority: boss.publicKey, employer, stream: invite, vault: vaultOf(invite), mint,
        employerToken: source.address, tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, memoProgram: MEMO_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

  // 1. One running salary, one invite nobody will accept.
  await send("create_stream (salary, 6 000,00 zł, 120 s)", [await create(stream, employee.publicKey)]);
  await send("create_stream (invite nobody accepts)", [await create(invite, Keypair.generate().publicKey)]);
  streamCount = streamCount.addn(2);
  await send("fund_stream 6 000,00 zł + 1 000,00 zł", [await fund(stream, NET), await fund(invite, INVITE_FUNDING)]);
  await send(
    "accept_stream (employee signs, employer pays the fee)",
    [await program.methods.acceptStream(Array(32).fill(0)).accountsPartial({ employee: employee.publicKey, stream, employer }).instruction()],
    [employee],
  );

  // 2. Cancelling the invite too early is refused; the program logs when it becomes allowed.
  await refused("cancel_unaccepted before the grace period", "CancelTooEarly", [await cancel()]);

  // 3. End of employment: never in the past.
  await refused("end_employment backdated by 60 s (Try anyway)", "BackdatingNotAllowed", [
    await endAt((await clusterTime()) - 60),
  ]);
  await send(`end_employment at +${END_AT} s`, [await endAt(start + END_AT)]);

  // 4. Grace over (a tenth of 120 s): the invite's funding comes back.
  await waitUntil(start + PERIOD / 10, "the invite's grace period");
  await send(`cancel_unaccepted refunds ${zl(INVITE_FUNDING)}`, [await cancel()]);

  // 5. Take earned money.
  await waitUntil(start + PERIOD / 3, "a third of the month");
  await send(
    `withdraw_earned ${zl(TAKE)}`,
    [
      await program.methods
        .withdrawEarned(new BN(TAKE))
        .accountsPartial({
          payer: boss.publicKey, employee: employee.publicKey, stream, vault, mint,
          destination: ata(mint, employee.publicKey), tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .instruction(),
    ],
    [employee],
  );

  // 6. Adjustments: consent, a replaced proposal, a stale consent refused.
  await send(`propose_adjustment −${zl(FIRST_CUT)} (sick leave)`, [await propose(FIRST_CUT, 1)]);
  await send(`accept_adjustment −${zl(FIRST_CUT)} (employee)`, [await accept(FIRST_CUT)], [employee]);
  await send(`propose_adjustment −${zl(SECOND_CUT)} (correction) resets consent`, [await propose(SECOND_CUT, 3)]);
  const s = await program.account.stream.fetch(stream);
  if (s.adjustmentAccepted) throw new Error("a new proposal must reset consent");
  if (PAUSE > 0) await waitUntil((await clusterTime()) + PAUSE, "you to look at the pending adjustment");
  await refused("accept_adjustment of the old amount", "AdjustmentChanged", [await accept(FIRST_CUT)], [employee]);
  await send(`accept_adjustment −${zl(SECOND_CUT)} (employee)`, [await accept(SECOND_CUT)], [employee]);

  // 7. Payday, triggered by a wallet that is neither party.
  await waitUntil(end, "payday");
  await send(
    "settle (payday, signed by a third party)",
    [
      await program.methods
        .settle()
        .accountsPartial({
          payer: anyone.publicKey, stream, employer, employee: employee.publicKey,
          employerAuthority: boss.publicKey, vault, mint,
          employeeToken: ata(mint, employee.publicKey), employerToken: source.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID, systemProgram: SystemProgram.programId,
        })
        .instruction(),
    ],
    [anyone],
  );

  // earned_final 5 000 (ended at 100/120 s); accepted cut 2 500; taken 1 000 → 1 500 paid.
  const paid = await getAccount(connection, ata(mint, employee.publicKey), "confirmed", TOKEN_2022_PROGRAM_ID);
  const left = await getAccount(connection, vault, "confirmed", TOKEN_2022_PROGRAM_ID);
  const inviteLeft = await getAccount(connection, vaultOf(invite), "confirmed", TOKEN_2022_PROGRAM_ID);
  console.log(
    `\nemployee received ${zl(paid.amount)} in total · vaults hold ${zl(left.amount)} and ${zl(inviteLeft.amount)}`,
  );
  if (paid.amount !== 250_000n || left.amount !== 0n || inviteLeft.amount !== 0n) {
    throw new Error("unexpected final balances");
  }
  console.log(`\nreceipt     ${APP}/#/s/${stream.toBase58()}?c=Piekarnia%20Nowak&n=Oksana`);
  console.log(`cancelled   ${APP}/#/s/${invite.toBase58()}`);
  console.log(`big screen  ${APP}/#/screen/${boss.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
