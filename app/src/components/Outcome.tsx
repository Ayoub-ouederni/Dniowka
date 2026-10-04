import type { ReactNode } from "react";

import { copy, type ErrorContext } from "../copy";
import { failureSentence } from "../failure";
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
      <div className="outcome pending" role="status">
        <Stamp kind="confirming">{copy.common.confirming}</Stamp>
      </div>
    );
  }
  const { outcome } = state;
  if (outcome.ok) {
    if (!success) return null;
    return (
      <div className="outcome ok" role="status">
        <p className="result">{success}</p>
        <ProofLink signature={outcome.signature} />
      </div>
    );
  }
  const f = outcome.failure;
  return (
    <div className={f.kind === "program" ? "outcome refused" : "outcome failed"} role="alert">
      {f.kind === "program" && <Stamp kind="refused">{copy.stamps.refused}</Stamp>}
      <p className="result">{failureSentence(f, context)}</p>
      {outcome.signature && <ProofLink signature={outcome.signature} />}
    </div>
  );
}
