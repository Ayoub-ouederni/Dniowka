import { useEffect, useRef } from "react";

import { copy } from "../copy";
import { formatZl } from "../format";
import type { ActionState } from "../hooks";
import type { Tear } from "../tear";
import { HoldButton } from "./HoldButton";
import { Outcome } from "./Outcome";
import { ProofLink } from "./ProofLink";
import { Receipt } from "./Receipt";

export function TakePanel({
  tear,
  steps,
  available,
  withdrawn,
  funded,
  state,
  lastTaken,
  payday,
  onTake,
  onDismiss,
}: {
  tear: Tear;
  steps: bigint[];
  available: bigint | null;
  withdrawn: bigint;
  funded: bigint;
  state: ActionState | null;
  lastTaken: bigint;
  payday: number;
  onTake: (amount: bigint, mode: "normal" | "tryAnyway") => Promise<void>;
  onDismiss: () => void;
}) {
  const s = copy.salary;
  // Each step replaces the focused button: move focus to the new step's first control
  // (not on first render, so loading the page never steals focus).
  const panelRef = useRef<HTMLElement>(null);
  const step =
    state?.phase === "pending" || state?.phase === "done"
      ? state.phase
      : `${tear.mode}-${tear.typed === null}`;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("input, button:not(:disabled)") ?? panel)?.focus();
  }, [step]);

  if (state?.phase === "pending") {
    return (
      <section className="take-panel" ref={panelRef} tabIndex={-1}>
        <Outcome state={state} success="" />
      </section>
    );
  }
  if (state?.phase === "done") {
    const { outcome } = state;
    return (
      <section className="take-panel" role="status" ref={panelRef} tabIndex={-1}>
        {outcome.ok ? (
          <div className="arrived">
            <p className="arrived-amount">{s.tookBig(formatZl(lastTaken))}</p>
            <p>{s.tookSub}</p>
            <ProofLink signature={outcome.signature} />
          </div>
        ) : outcome.failure.kind === "program" ? null : (
          <Outcome state={state} success="" context={{ payday }} />
        )}
        <button className="secondary wide" onClick={onDismiss}>
          {outcome.ok ? s.done : copy.common.back}
        </button>
      </section>
    );
  }

  if (tear.mode === "idle") {
    return (
      <section className="take-panel" ref={panelRef} tabIndex={-1}>
        {available === 0n && <p className="small">{s.nothingYet}</p>}
        <button className="primary wide" disabled={available === null} onClick={tear.open}>
          {s.take}
        </button>
      </section>
    );
  }

  const amount = tear.amountFor(steps);
  const tooMuch = amount !== null && available !== null && amount > available;

  if (tear.mode === "review" && amount !== null && !tooMuch) {
    return (
      <section className="take-panel" ref={panelRef} tabIndex={-1}>
        <Receipt
          title={s.receiptTitle}
          lines={[
            { label: s.youGet, value: formatZl(amount), strong: true, plus: true },
            { label: s.fee, value: formatZl(0n) },
            { label: s.takenAfter, value: formatZl(withdrawn + amount) },
            { label: s.staysInVault, value: formatZl(funded - withdrawn - amount) },
          ]}
        />
        <HoldButton
          label={s.hold(formatZl(amount))}
          holdingLabel={s.holding}
          hint={s.holdHint}
          onConfirm={() => void onTake(amount, "normal")}
        />
        <button className="quiet-dark" onClick={tear.back}>
          {copy.common.back}
        </button>
      </section>
    );
  }

  const k = tear.k(steps);
  return (
    <section className="take-panel tearing-panel" ref={panelRef} tabIndex={-1}>
      <p className="small">{s.tearIntro}</p>
      {tear.typed === null ? (
        <div className="stepper" role="group" aria-label={s.tearAmount}>
          <button
            type="button"
            className="step"
            aria-label={s.less}
            disabled={k <= 1}
            onClick={() => tear.pick(k - 1, steps.length)}
          >
            −
          </button>
          <output className="step-value" aria-live="polite">
            {amount !== null ? formatZl(amount) : "…"}
          </output>
          <button
            type="button"
            className="step"
            aria-label={s.more}
            disabled={k >= steps.length}
            onClick={() => tear.pick(k + 1, steps.length)}
          >
            +
          </button>
        </div>
      ) : (
        <label>
          {s.amount}
          <input
            value={tear.typed}
            onChange={(e) => tear.type(e.target.value)}
            inputMode="decimal"
          />
        </label>
      )}
      <div className="tear-links">
        {tear.typed === null && steps.length > 1 && (
          <button
            type="button"
            className="link"
            onClick={() => tear.pick(steps.length, steps.length)}
          >
            {s.all}
          </button>
        )}
        <button
          type="button"
          className="link"
          onClick={() => tear.type(tear.typed === null ? "" : null)}
        >
          {tear.typed === null ? s.typeAmount : s.hideTyped}
        </button>
      </div>
      {tooMuch && <p className="error">{s.tooMuch}</p>}
      {/* A hint only: the program decides, and "Try anyway" lets it refuse on-chain. */}
      {tooMuch && amount !== null ? (
        <button
          type="button"
          className="danger wide"
          title={s.tryAnywayHint}
          onClick={() => void onTake(amount, "tryAnyway")}
        >
          {s.tryAnyway}
        </button>
      ) : (
        <button
          className="primary wide"
          disabled={amount === null || amount === 0n}
          onClick={tear.review}
        >
          {s.continue}
        </button>
      )}
      <button className="quiet-dark" onClick={tear.close}>
        {s.cancel}
      </button>
    </section>
  );
}
