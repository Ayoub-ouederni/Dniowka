/**
 * DEV ONLY (`#/dev/gallery`, never in `vite build`): the real components with sample data,
 * for visual QA of states a test account can't reach without devnet SOL (tear, receipt,
 * hold, +X zł, ODMOWA, payday). Nothing here talks to the chain.
 */
import { useEffect, useState } from "react";

import { FlipClock } from "../components/FlipClock";
import { ProofLink } from "../components/ProofLink";
import { Receipt } from "../components/Receipt";
import { Stamp } from "../components/Stamp";
import { Strip } from "../components/Strip";
import { TakePanel } from "../components/TakeMoney";
import { copy } from "../copy";
import { formatZl } from "../format";
import type { ActionState } from "../hooks";
import { stripCoupons, tearSteps } from "../strip";
import { useTear } from "../tear";

const NET = 600_000n;
const SIG =
  "4hijLbvfWy14KQVhfsNPYnsqmN9TV5htr9WznLeG5cqZywbCR8VZEN4xWfVcegWuhtkqqzhF49FuGmwmLqLLme77";
const base = {
  earned: 250_000n,
  withdrawn: 80_000n,
  net: NET,
  periodStart: 0,
  periodEnd: 1_800,
  endTs: null as number | null,
  now: 750,
};
const AVAILABLE = 95_000n;
const noop = async () => {};

export function Gallery() {
  const steps = tearSteps(base.withdrawn, AVAILABLE, NET);
  const tear = useTear("tear", 3);
  const review = useTear("review", 3);
  const typed = useTear("tear", 1);
  const [fly, setFly] = useState(0);
  const [flying, setFlying] = useState(false);
  // Same timing as Salary: the coupons fly, then the strip settles to stubs.
  useEffect(() => {
    if (!flying) return;
    const t = setTimeout(() => setFlying(false), 2_400);
    return () => clearTimeout(t);
  }, [flying, fly]);
  const arrived: ActionState = {
    phase: "done",
    instruction: "withdraw_earned",
    outcome: { ok: true, signature: SIG },
  };
  const pending: ActionState = { phase: "pending", instruction: "withdraw_earned" };

  return (
    <main className="screen gallery">
      <h1>Gallery (dev)</h1>

      <h2>1 · Tear: 3 days selected</h2>
      <div className="g-row">
        <Strip
          coupons={stripCoupons(base)}
          withdrawn={base.withdrawn}
          net={NET}
          selected={tear.amountFor(steps) ?? 0n}
          onPick={(i) => tear.pick(i - 4 + 1, steps.length)}
        />
        <TakePanel
          tear={tear}
          steps={steps}
          available={AVAILABLE}
          withdrawn={base.withdrawn}
          funded={NET}
          state={null}
          lastTaken={0n}
          payday={1_800}
          onTake={noop}
          onDismiss={() => {}}
        />
      </div>

      <h2>2 · Receipt, then hold to confirm</h2>
      <TakePanel
        tear={review}
        steps={steps}
        available={AVAILABLE}
        withdrawn={base.withdrawn}
        funded={NET}
        state={null}
        lastTaken={0n}
        payday={1_800}
        onTake={noop}
        onDismiss={() => {}}
      />

      <h2>3 · Exact amount above available</h2>
      <div className="g-typed">
        <TakePanel
          tear={{ ...typed, typed: typed.typed ?? "5000", amountFor: () => 500_000n }}
          steps={steps}
          available={AVAILABLE}
          withdrawn={base.withdrawn}
          funded={NET}
          state={null}
          lastTaken={0n}
          payday={1_800}
          onTake={noop}
          onDismiss={() => {}}
        />
      </div>

      <h2>4 · Confirming, then +X zł</h2>
      <TakePanel
        tear={tear}
        steps={steps}
        available={AVAILABLE}
        withdrawn={base.withdrawn}
        funded={NET}
        state={pending}
        lastTaken={0n}
        payday={1_800}
        onTake={noop}
        onDismiss={() => {}}
      />
      <TakePanel
        tear={tear}
        steps={steps}
        available={AVAILABLE}
        withdrawn={base.withdrawn}
        funded={NET}
        state={arrived}
        lastTaken={80_000n}
        payday={1_800}
        onTake={noop}
        onDismiss={() => {}}
      />

      <h2>5 · ODMOWA over the strip, ended at day 20, a part-taken day</h2>
      <Strip
        coupons={stripCoupons({ ...base, withdrawn: 85_000n, endTs: 1_200 })}
        withdrawn={85_000n}
        net={NET}
        stamp={
          <>
            <Stamp kind="refused">{copy.stamps.refused}</Stamp>
            <p className="stamp-reason" role="alert">
              {copy.failure.program("ExceedsAvailable", { earned: 250_000n, available: 95_000n })}
            </p>
            <ProofLink signature={SIG} />
          </>
        }
      />

      <h2>6 · Payday: coupons fly, WYPŁACONO</h2>
      <button
        className="secondary"
        onClick={() => {
          setFly((f) => f + 1);
          setFlying(true);
        }}
      >
        Replay
      </button>
      <div className="g-row">
        <Strip
          key={fly}
          coupons={stripCoupons({ ...base, earned: NET })}
          withdrawn={base.withdrawn}
          net={NET}
          paid
          fly={flying}
          stamp={
            <div className={flying ? "late" : ""}>
              <Stamp kind="paid">{copy.stamps.paid}</Stamp>
            </div>
          }
        />
        <Receipt
          title={copy.salary.paidReceiptTitle}
          lines={[
            { label: copy.salary.paidEarned, value: formatZl(NET) },
            { label: copy.salary.paidTaken, value: formatZl(100_000n) },
            { label: copy.salary.paidCutReason(2, false), value: `−${formatZl(20_000n)}` },
            { label: copy.salary.paidNow, value: formatZl(480_000n), strong: true, plus: true },
          ]}
        >
          <ProofLink signature={SIG} />
        </Receipt>
      </div>

      <h2>7 · Flip clock</h2>
      <div className="g-cobalt">
        <FlipClock seconds={18 * 60 + 5} />
      </div>
    </main>
  );
}
