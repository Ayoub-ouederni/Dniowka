/**
 * Turns what the network and the wallet report into something the UI can say in plain words.
 * The numbers in a refusal (earned / available) come from the program's own log line.
 */
import idl from "./idl/dniowka.json";

export type ProgramError = { code: number; name: string };

export type Failure =
  | ({
      kind: "program";
      earned?: bigint;
      available?: bigint;
      /** CancelTooEarly: when cancelling becomes allowed (program log). */
      cancelFrom?: number;
    } & ProgramError)
  | { kind: "cancelled" }
  | { kind: "noFees" }
  | { kind: "network" }
  | { kind: "unknown"; message: string };

const NAMES = new Map(idl.errors.map((e) => [e.code, e.name]));

/** Program error code (6000+) → its name in the IDL, e.g. 6000 → `ExceedsAvailable`. */
export function errorName(code: number): string | null {
  return NAMES.get(code) ?? null;
}

type Logs = readonly string[] | null | undefined;

const EARNED_LINE = /Program log: earned (\d+) available (\d+)/;
const CUT_CAP_LINE = /Program log: cut cap (\d+) with consent (\d+)/;
const CANCEL_FROM_LINE = /Program log: cancel allowed from (-?\d+)/;
const ANCHOR_ERROR = /Error Code: (\w+)\. Error Number: (\d+)\./;

/** The `earned X available Y` line that `withdraw_earned` logs before checking the amount. */
export function parseEarnedAvailable(logs: Logs): { earned: bigint; available: bigint } | null {
  for (const line of logs ?? []) {
    const m = EARNED_LINE.exec(line);
    if (m) return { earned: BigInt(m[1]), available: BigInt(m[2]) };
  }
  return null;
}

export type CutCaps = { withoutConsent: bigint; withConsent: bigint };

/** The `cut cap X with consent Y` line that `propose_adjustment` logs before its checks. */
export function parseCutCaps(logs: Logs): CutCaps | null {
  for (const line of logs ?? []) {
    const m = CUT_CAP_LINE.exec(line);
    if (m) return { withoutConsent: BigInt(m[1]), withConsent: BigInt(m[2]) };
  }
  return null;
}

/** The `cancel allowed from T` line that `cancel_unaccepted` logs before its checks. */
export function parseCancelFrom(logs: Logs): number | null {
  for (const line of logs ?? []) {
    const m = CANCEL_FROM_LINE.exec(line);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Which rule refused the transaction: from the Anchor error log, else from `{Custom: n}`. */
export function parseProgramError(logs: Logs, err?: unknown): ProgramError | null {
  for (const line of logs ?? []) {
    const m = ANCHOR_ERROR.exec(line);
    if (m) return { code: Number(m[2]), name: m[1] };
  }
  const custom = customCode(err);
  if (custom === null) return null;
  const name = errorName(custom);
  return name ? { code: custom, name } : null;
}

function customCode(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("InstructionError" in err)) return null;
  const detail = (err as { InstructionError: [number, unknown] }).InstructionError[1];
  if (detail && typeof detail === "object" && "Custom" in detail) {
    const code = (detail as { Custom: unknown }).Custom;
    return typeof code === "number" ? code : null;
  }
  return null;
}

function logsOf(e: unknown): string[] {
  if (!e || typeof e !== "object") return [];
  const logs = (e as { logs?: unknown }).logs;
  return Array.isArray(logs) ? logs.filter((l): l is string => typeof l === "string") : [];
}

/** Classify anything thrown while sending, so the UI can pick a human sentence. */
export function classifyFailure(e: unknown, extraLogs?: Logs): Failure {
  const logs = [...logsOf(e), ...(extraLogs ?? [])];
  const err = e && typeof e === "object" ? (e as { err?: unknown }).err : undefined;
  const program = parseProgramError(logs, err);
  if (program) {
    const numbers = parseEarnedAvailable(logs);
    const cancelFrom = parseCancelFrom(logs);
    return {
      kind: "program",
      ...program,
      ...(numbers ?? {}),
      ...(cancelFrom !== null ? { cancelFrom } : {}),
    };
  }

  const message =
    e instanceof Error
      ? e.message
      : e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
  const name = e instanceof Error ? e.name : "";
  const code = e && typeof e === "object" ? (e as { code?: unknown }).code : undefined;

  if (code === 4001 || /reject|cancel|declin/i.test(message) || /WalletWindowClosed/.test(name)) {
    return { kind: "cancelled" };
  }
  // Some wallets only pass on the simulation error as text.
  const hex = /custom program error: 0x([0-9a-f]+)/i.exec(message);
  const textName = hex ? errorName(parseInt(hex[1], 16)) : null;
  if (hex && textName) return { kind: "program", code: parseInt(hex[1], 16), name: textName };
  const text = `${message}\n${logs.join("\n")}`;
  if (/no record of a prior credit|insufficient lamports|insufficient funds for fee/i.test(text)) {
    return { kind: "noFees" };
  }
  if (/Failed to fetch|NetworkError|ECONNREFUSED|timed? ?out|429/i.test(message)) {
    return { kind: "network" };
  }
  return { kind: "unknown", message };
}
