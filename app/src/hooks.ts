import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { TransactionInstruction } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { makeProgram } from "./chain/program";
import { type TxOutcome, sendNormal, sendTryAnyway } from "./chain/send";

export function useProgram() {
  const { connection } = useConnection();
  return useMemo(() => makeProgram(connection), [connection]);
}

export type ActionState =
  | { phase: "idle" }
  | { phase: "pending"; instruction: string }
  | { phase: "done"; instruction: string; outcome: TxOutcome };

/** Runs one on-chain action at a time and keeps its outcome for the result panel. */
export function useAction() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [state, setState] = useState<ActionState>({ phase: "idle" });

  const run = useCallback(
    async (
      instruction: string,
      build: () => Promise<TransactionInstruction[]>,
      mode: "normal" | "tryAnyway" = "normal",
    ): Promise<TxOutcome> => {
      setState({ phase: "pending", instruction });
      let outcome: TxOutcome;
      try {
        const ixs = await build();
        outcome =
          mode === "normal"
            ? await sendNormal(connection, wallet, ixs)
            : await sendTryAnyway(connection, wallet, ixs);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        outcome = { ok: false, signature: null, failure: { kind: "unknown", message } };
      }
      setState({ phase: "done", instruction, outcome });
      return outcome;
    },
    [connection, wallet],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, run, reset };
}

/** Re-runs `load` every `ms` while mounted; `reload` forces a refresh now. */
export function usePoll<T>(load: () => Promise<T>, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = async () => {
      try {
        const value = await loadRef.current();
        if (alive) {
          setData(value);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e);
      }
      if (alive) timer = setTimeout(step, ms);
    };
    step();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-provided deps
  }, [ms, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

/**
 * The cluster clock between polls: the last on-chain time plus the seconds elapsed since it
 * was read. The device clock is never used as "now" on its own.
 */
export function useClusterNow(clusterNow: number | undefined): number | undefined {
  const [tick, setTick] = useState({ base: clusterNow, seconds: 0 });
  useEffect(() => {
    if (clusterNow === undefined) return;
    const readAt = Date.now();
    const id = setInterval(() => {
      setTick({ base: clusterNow, seconds: Math.floor((Date.now() - readAt) / 1000) });
    }, 1_000);
    return () => clearInterval(id);
  }, [clusterNow]);
  if (clusterNow === undefined) return undefined;
  return tick.base === clusterNow ? clusterNow + tick.seconds : clusterNow;
}

/** What the "Under the hood" drawer shows about the last action. */
export function lastActionHood(state: ActionState) {
  if (state.phase === "idle") return {};
  if (state.phase === "pending") return { instruction: state.instruction };
  const { outcome } = state;
  return {
    instruction: state.instruction,
    signature: outcome.signature,
    failed: !outcome.ok,
    errorCode:
      !outcome.ok && outcome.failure.kind === "program"
        ? `${outcome.failure.name} (${outcome.failure.code})`
        : null,
  };
}
