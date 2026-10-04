/**
 * Mints test zł to an employer's wallet so they can secure salaries (devnet only).
 *
 *   pnpm run seed -- <wallet address> [zł, default 20000]
 *
 * The dev wallet (ANCHOR_WALLET, default ~/.config/solana/id.json) is the mint authority
 * and pays for the zł account if it doesn't exist yet. This is the "demo faucet for test
 * tokens" the challenge allows off-chain; it decides nothing about salaries.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const RPC = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
const WALLET = process.env.ANCHOR_WALLET ?? `${homedir()}/.config/solana/id.json`;
const ZL_MINT = new PublicKey("CaWiQGxgnqhB3gAEuC8r7KHe1N1dTJCa7BJ3oFzjUaKS");

const zl = (grosze: bigint) =>
  `${(Number(grosze) / 100).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`;

async function main() {
  const [target, amount = "20000"] = process.argv.slice(2).filter((a) => a !== "--");
  if (!target) throw new Error("usage: pnpm run seed -- <wallet address> [zł]");
  const owner = new PublicKey(target);
  const grosze = BigInt(Math.round(Number(amount.replace(",", ".")) * 100));
  if (grosze <= 0n) throw new Error(`invalid amount: ${amount}`);

  const connection = new Connection(RPC, "confirmed");
  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(WALLET, "utf8")) as number[]),
  );
  const account = await getOrCreateAssociatedTokenAccount(
    connection, authority, ZL_MINT, owner, true, "confirmed", undefined, TOKEN_2022_PROGRAM_ID,
  );
  const sig = await mintTo(
    connection, authority, ZL_MINT, account.address, authority, grosze, [], { commitment: "confirmed" },
    TOKEN_2022_PROGRAM_ID,
  );
  console.log(`minted ${zl(grosze)} to ${owner.toBase58()}`);
  console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
