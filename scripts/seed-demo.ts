/**
 * Prepares the demo salaries of spec §9 on devnet (30-minute month: 1 minute = 1 day, 6 000 zł).
 *
 *   pnpm run seed:demo [-- --employee <Oksana's account address>]
 *
 * The dev wallet is the employer (Piekarnia Nowak) and pays every fee and rent. It creates:
 *   1. Oksana, fresh invite, secured: she opens the link and joins (demo step 2).
 *   2. Oksana, "day 12" (started DAY minutes ago, default 12): she takes 800 zł and is refused
 *      5 000 zł (steps 3–4). With --employee it is locked to her account and waits for her to
 *      join in the app (earned counts from the start of the month, not from joining); without
 *      it, a throwaway employee joins now and the salary can be watched, not taken.
 *   3. Marek, payday in PAYDAY_IN minutes (default 5): joined, has taken 1 000 zł, with a
 *      200 zł adjustment (unpaid absence) inside what the employer may apply alone (step 7).
 * Run `pnpm run reset-demo` first to clear salaries left from an earlier run.
 */
import { BN } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

import {
  APP,
  ata,
  boss,
  clusterTime,
  connection,
  employerPda,
  program,
  retry,
  send,
  streamAt,
  vaultOf,
  zl,
} from "./lib/devnet";

const NET = 600_000; // 6 000,00 zł
const FLOOR_BPS = 7_000;
const DAY_SECONDS = 60;
const MONTH = 30 * DAY_SECONDS;
const DAY = Number(process.env.DAY ?? "12");
const PAYDAY_IN = Number(process.env.PAYDAY_IN ?? "5");
const MAREK_TOOK = 100_000; // 1 000,00 zł
const MAREK_CUT = 20_000; // 200,00 zł, unpaid absence
const COMPANY = "Piekarnia Nowak";

const args = process.argv.slice(2).filter((a) => a !== "--");
const employeeArg = args.includes("--employee") ? args[args.indexOf("--employee") + 1] : null;

async function main() {
  const oksana = employeeArg ? new PublicKey(employeeArg) : null;
  const employer = await retry(() => program.account.employer.fetchNullable(employerPda));
  if (!employer) throw new Error("the dev wallet has no employer account (run `pnpm run smoke`)");
  const mint = employer.mint;

  const source = await getOrCreateAssociatedTokenAccount(
    connection, boss, mint, boss.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID,
  );
  const needed = BigInt(3 * NET);
  if (source.amount < needed) {
    await mintTo(
      connection, boss, mint, source.address, boss, needed - source.amount, [], undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    console.log(`minted ${zl(needed - source.amount)} of test zł to the employer`);
  }

  const now = await clusterTime();
  const first = employer.streamCount;
  const ids = { invite: first, day: first.addn(1), payday: first.addn(2) };
  const at = (id: BN) => streamAt(id);
  const helper = Keypair.generate(); // throwaway "Oksana" when no --employee is given
  const marek = Keypair.generate();

  const create = (id: BN, hint: PublicKey | null, start: number) =>
    program.methods
      .createStream(hint, new BN(NET), new BN(start), new BN(start + MONTH), new BN(start + MONTH), FLOOR_BPS)
      .accountsPartial({
        payer: boss.publicKey, authority: boss.publicKey, employer: employerPda, stream: at(id),
        vault: vaultOf(at(id)), mint, tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  const fund = (id: BN) =>
    program.methods
      .fundStream(new BN(NET))
      .accountsPartial({
        authority: boss.publicKey, employer: employerPda, stream: at(id), vault: vaultOf(at(id)),
        mint, source: source.address, tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();
  const accept = (id: BN, who: PublicKey) =>
    program.methods
      .acceptStream(Array(32).fill(0))
      .accountsPartial({ employee: who, stream: at(id), employer: employerPda })
      .instruction();

  const dayStart = now - DAY * DAY_SECONDS;
  const paydayStart = now + PAYDAY_IN * 60 - MONTH;
  await send(`Oksana: fresh invite, ${zl(NET)} secured`, [
    await create(ids.invite, oksana, now), await fund(ids.invite),
  ]);
  await send(`Oksana: day ${DAY} salary, ${zl(NET)} secured`, [
    await create(ids.day, oksana ?? helper.publicKey, dayStart), await fund(ids.day),
  ]);
  if (!oksana) {
    await send("Oksana (throwaway account) joins the day-12 salary", [await accept(ids.day, helper.publicKey)], [helper]);
  }
  await send(`Marek: payday in ${PAYDAY_IN} min, ${zl(NET)} secured, joined`, [
    await create(ids.payday, marek.publicKey, paydayStart), await fund(ids.payday),
    await accept(ids.payday, marek.publicKey),
  ], [marek]);
  await send(`Marek takes ${zl(MAREK_TOOK)} already earned`, [
    await program.methods
      .withdrawEarned(new BN(MAREK_TOOK))
      .accountsPartial({
        payer: boss.publicKey, employee: marek.publicKey, stream: at(ids.payday),
        vault: vaultOf(at(ids.payday)), mint, destination: ata(mint, marek.publicKey),
        tokenProgram: TOKEN_2022_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction(),
  ], [marek]);
  await send(`Payday adjustment for Marek: −${zl(MAREK_CUT)} (unpaid absence)`, [
    await program.methods
      .proposeAdjustment(new BN(MAREK_CUT), 2)
      .accountsPartial({ authority: boss.publicKey, employer: employerPda, stream: at(ids.payday) })
      .instruction(),
  ]);

  const link = (id: BN, name: string) =>
    `${APP}/#/s/${at(id).toBase58()}?c=${encodeURIComponent(COMPANY)}&n=${encodeURIComponent(name)}`;
  const labels = new URLSearchParams({ a: boss.publicKey.toBase58(), c: COMPANY });
  labels.set(at(ids.invite).toBase58(), "Oksana");
  labels.set(at(ids.day).toBase58(), "Oksana");
  labels.set(at(ids.payday).toBase58(), "Marek");

  console.log(`\nOksana, invite      ${link(ids.invite, "Oksana")}`);
  console.log(`Oksana, day ${DAY}      ${link(ids.day, "Oksana")}${oksana ? "  (she joins it before the demo)" : "  (watch only)"}`);
  console.log(`Marek, payday soon  ${link(ids.payday, "Marek")}`);
  console.log(`names + big screen  ${APP}/#/labels?${labels.toString()}`);
  console.log(`\nPayday for Marek at cluster time ${paydayStart + MONTH}; anyone can run it from his link.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
