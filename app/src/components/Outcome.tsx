import type { ReactNode } from "react";

import { copy, type ErrorContext } from "../copy";
import type { ActionState } from "../hooks";
import { ProofLink } from "./ProofLink";
import { Stamp } from "./Stamp";

type Props = {
  state: ActionState;
  success: ReactNode;
  context?: ErrorContext;
};

/** Human result first, proof link second (spec §6.4). */
export function Outcome({ state, success, context = {} }: Props) {
  if (state.phase === "idle") return null;
  if (state.phase === "pending") {
    return (
      <div className="outcome pending">
        <Stamp kind="confirming">{copy.common.confirming}</Stamp>
      </div>
    );
  }
  const { outcome } = state;
  if (outcome.ok) {
    return (
      <div className="outcome ok">
        <p className="result">{success}</p>
        <ProofLink signature={outcome.signature} />
      </div>
    );
  }
  const f = outcome.failure;
  const sentence =
    f.kind === "program"
      ? copy.failure.program(f.name, { earned: f.earned, available: f.available, ...context })
      : f.kind === "unknown"
        ? copy.failure.unknown
        : copy.failure[f.kind];
  return (
    <div className={f.kind === "program" ? "outcome refused" : "outcome failed"}>
      {f.kind === "program" && <Stamp kind="refused">{copy.stamps.refused}</Stamp>}
      <p className="result">{sentence}</p>
      {outcome.signature && <ProofLink signature={outcome.signature} />}
    </div>
  );
}
