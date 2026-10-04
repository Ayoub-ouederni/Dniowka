import { PublicKey } from "@solana/web3.js";

import idl from "./idl/dniowka.json";

/** Devnet only (spec §0.5 rule 1). */
export const RPC_URL = import.meta.env?.VITE_RPC_URL ?? "https://api.devnet.solana.com";
export const CLUSTER = "devnet";

export const PROGRAM_ID = new PublicKey(idl.address);

/**
 * Test zł: clean Token-2022 mint from the M1 smoke run (2 decimals, no freeze authority,
 * no extensions). Mint authority is the dev wallet; `pnpm run seed` hands it out.
 */
export const ZL_MINT = new PublicKey("CaWiQGxgnqhB3gAEuC8r7KHe1N1dTJCa7BJ3oFzjUaKS");

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/** Floor suggested to new employers (70 % of earned is always withdrawable). */
export const DEFAULT_FLOOR_BPS = 7_000;

/** How often screens re-read the chain. ~2 requests per screen per tick. */
export const POLL_MS = 4_000;

export const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
export const explorerAddress = (address: PublicKey | string) =>
  `https://explorer.solana.com/address/${address.toString()}?cluster=${CLUSTER}`;
