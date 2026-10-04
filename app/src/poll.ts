/** Longest pause between two reads while the RPC keeps failing (public devnet 429s). */
export const MAX_POLL_MS = 30_000;

/** Delay before the next read: the normal pace, doubled per failure in a row, capped. */
export function pollDelay(ms: number, failures: number): number {
  return Math.min(ms * 2 ** Math.min(failures, 10), MAX_POLL_MS);
}
