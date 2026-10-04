import type { Failure } from "./chain/errors";
import { copy, type ErrorContext } from "./copy";

/** The human sentence for a failure (never a raw code). */
export function failureSentence(f: Failure, context: ErrorContext = {}): string {
  if (f.kind === "program") {
    return copy.failure.program(f.name, {
      earned: f.earned,
      available: f.available,
      cancelFrom: f.cancelFrom,
      ...context,
    });
  }
  return f.kind === "unknown" ? copy.failure.unknown : copy.failure[f.kind];
}
