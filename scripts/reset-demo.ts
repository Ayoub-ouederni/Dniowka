/**
 * Clears the dev employer's salaries left half-way (devnet only).
 *
 *   pnpm run reset-demo [-- --dry-run] [-- --wait <minutes>]
 *
 * Settles every running salary whose payday has come (the dev wallet signs as the "anyone"
 * caller, so the employee's pay goes to the employee as usual) and cancels every invite past
 * its grace period (the secured money goes back to the employer). Anything not due yet is
 * listed with the moment it becomes due; `--wait N` waits up to N minutes for those.
 * The program checks every rule: this script only decides what to ask for.
 */
import type { PublicKey } from "@solana/web3.js";

import {
  APP,
  boss,
  cancelIx,
  clusterTime,
  employerPda,
  program,
  retry,
  send,
  settleIx,
  statusOf,
  streamAt,
  waitUntil,
  zl,
  type StreamAccount,
} from "./lib/devnet";
import { type ResetStep, planReset } from "./lib/reset-plan";

const args = process.argv.slice(2).filter((a) => a !== "--");
const dryRun = args.includes("--dry-run");
const waitIdx = args.indexOf("--wait");
const waitMinutes = waitIdx >= 0 ? Number(args[waitIdx + 1] ?? "0") : 0;

type Row = { address: PublicKey; id: number; s: StreamAccount };

async function loadStreams(): Promise<Row[]> {
  const employer = await retry(() => program.account.employer.fetchNullable(employerPda));
  if (!employer) throw new Error("the dev wallet has no employer account (run `pnpm run smoke`)");
  const count = employer.streamCount.toNumber();
  const addresses = Array.from({ length: count }, (_, id) => streamAt(id));
  const rows: Row[] = [];
  // fetchMultiple takes up to 100 accounts per request.
  for (let i = 0; i < addresses.length; i += 100) {
    const chunk = addresses.slice(i, i + 100);
    const accounts = await retry(() => program.account.stream.fetchMultiple(chunk));
    accounts.forEach((s, j) => {
      if (s) rows.push({ address: chunk[j], id: i + j, s });
    });
  }
  return rows;
}

const view = (s: StreamAccount) => ({
  status: statusOf(s),
  periodStart: s.periodStart.toNumber(),
  periodEnd: s.periodEnd.toNumber(),
  payday: s.payday.toNumber(),
});

function describe(step: ResetStep, now: number): string {
  switch (step.kind) {
    case "settle":
      return "payday due → settle";
    case "cancel":
      return "invite past grace → cancel";
    case "wait":
      return `${step.then} in ${step.until - now}s`;
    case "done":
      return "nothing to do";
  }
}

async function act(row: Row, step: ResetStep) {
  const label = `#${row.id} ${row.address.toBase58()}`;
  if (step.kind === "settle") {
    await send(`settle ${label}`, [await settleIx(row.address, row.s)]);
  } else if (step.kind === "cancel") {
    await send(
      `cancel_unaccepted ${label} (refunds ${zl(BigInt(row.s.funded.toString()))})`,
      [await cancelIx(row.address, row.s)],
    );
  }
}

async function vaultTotal(rows: Row[]): Promise<bigint> {
  const infos = await retry(() =>
    program.provider.connection.getMultipleAccountsInfo(rows.map((r) => r.s.vault), "confirmed"),
  );
  // Token account amount: u64 at offset 64 (mint 32 + owner 32).
  return infos.reduce((sum, info) => (info ? sum + info.data.readBigUInt64LE(64) : sum), 0n);
}

async function main() {
  console.log(`employer ${boss.publicKey.toBase58()} on devnet${dryRun ? " (dry run)" : ""}`);
  let rows = await loadStreams();
  let now = await clusterTime();
  console.log(`vaults hold ${zl(await vaultTotal(rows))} across ${rows.length} salaries\n`);

  const waiting: { row: Row; until: number }[] = [];
  for (const row of rows) {
    const step = planReset(view(row.s), now);
    if (step.kind === "done") continue;
    console.log(
      `#${row.id} ${statusOf(row.s)} ${zl(BigInt(row.s.funded.toString()))} secured · ${describe(step, now)}`,
    );
    if (step.kind === "wait") waiting.push({ row, until: step.until });
    else if (!dryRun) await act(row, step).catch((e) => console.error(`  ✘ ${String(e)}`));
  }

  const deadline = now + waitMinutes * 60;
  const soon = waiting.filter((w) => w.until <= deadline).sort((a, b) => a.until - b.until);
  if (!dryRun) {
    for (const w of soon) {
      await waitUntil(w.until + 1, `salary #${w.row.id}`);
      const fresh = await retry(() => program.account.stream.fetch(w.row.address));
      now = await clusterTime();
      const step = planReset(view(fresh), now);
      await act({ ...w.row, s: fresh }, step).catch((e) => console.error(`  ✘ ${String(e)}`));
    }
  }
  const left = waiting.length - (dryRun ? 0 : soon.length);
  if (left > 0) console.log(`\n${left} salaries not due yet (use --wait <minutes>).`);

  rows = await loadStreams();
  console.log(`\nvaults now hold ${zl(await vaultTotal(rows))}`);
  console.log(`big screen  ${APP}/#/screen/${boss.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
