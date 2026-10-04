import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useRef, useState } from "react";

import { POLL_MS } from "../chain/config";
import type { CutCaps } from "../chain/errors";
import { acceptAdjustmentIx, acceptStreamIx, settleIx, withdrawEarnedIx } from "../chain/program";
import {
  type EmployerView,
  type Settlement,
  type StreamView,
  fetchEmployerAt,
  fetchSettlement,
  fetchStreamAndNow,
  programCutCaps,
  programEarned,
  zlBalance,
} from "../chain/view";
import { ConnectButton } from "../components/ConnectButton";
import { Outcome } from "../components/Outcome";
import { ProofLink } from "../components/ProofLink";
import { Receipt } from "../components/Receipt";
import { Stamp } from "../components/Stamp";
import { Strip } from "../components/Strip";
import { TakePanel } from "../components/TakeMoney";
import { type HoodAccount, UnderTheHood } from "../components/UnderTheHood";
import { copy } from "../copy";
import { failureSentence } from "../failure";
import { formatCountdown, formatDateTime, formatZl } from "../format";
import { lastActionHood, useAction, useClusterNow, usePoll, useProgram } from "../hooks";
import { inviteLink } from "../route";
import { stripCoupons, takenWhole, tearSteps } from "../strip";
import { useTear } from "../tear";

type Props = { stream: string; company: string | null; employee: string | null };

type Loaded = {
  stream: StreamView;
  employer: EmployerView;
  now: number;
  figures: { earned: bigint; available: bigint } | null;
  /** Adjustment limits from the program, read only while an adjustment is pending. */
  caps: CutCaps | null;
  inAccount: bigint | null;
  settlement: Settlement | null;
};

/** How long the payday coupons take to fly up before the strip settles. */
const FLY_MS = 2_400;

function toKey(s: string): PublicKey | null {
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

export function Salary({ stream: address, company, employee: employeeName }: Props) {
  const key = toKey(address);
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const action = useAction();
  const employerCache = useRef<EmployerView | null>(null);
  const settlementCache = useRef<Settlement | null>(null);
  const [lastTaken, setLastTaken] = useState(0n);
  const [fly, setFly] = useState(false);
  const tear = useTear();

  const { data, error, reload } = usePoll<Loaded | null>(
    async () => {
      if (!key) return null;
      const { stream, now } = await fetchStreamAndNow(program, key);
      if (!stream) return null;
      const employer = employerCache.current ?? (await fetchEmployerAt(program, stream.employer));
      if (!employer) return null;
      employerCache.current = employer;
      const pendingAdjustment =
        stream.adjustment > 0n && !stream.adjustmentAccepted && now < stream.payday;
      const [figures, caps, inAccount, settlement] = await Promise.all([
        programEarned(program, stream, employer.authority).catch(() => null),
        pendingAdjustment
          ? programCutCaps(program, stream, employer.authority).catch(() => null)
          : null,
        publicKey && stream.status !== "invited" && stream.employee.equals(publicKey)
          ? zlBalance(connection, stream.mint, publicKey)
          : null,
        stream.status === "settled"
          ? (settlementCache.current ?? fetchSettlement(program, stream.address))
          : null,
      ]);
      if (settlement) settlementCache.current = settlement;
      return { stream, employer, now, figures, caps, inAccount, settlement };
    },
    POLL_MS,
    [address, publicKey?.toBase58(), program],
  );
  const now = useClusterNow(data?.now);

  // "Connect and join": once the person has connected, join straight away.
  const [joinRequested, setJoinRequested] = useState(false);
  const join = async () => {
    if (!publicKey || !data) return;
    setJoinRequested(false);
    const { stream, employer } = data;
    const outcome = await action.run("accept_stream", async () => [
      await acceptStreamIx(program, publicKey, stream.address, employer.address),
    ]);
    if (outcome.ok) reload();
  };
  const joinRef = useRef(join);
  useEffect(() => {
    joinRef.current = join;
  });
  useEffect(() => {
    if (joinRequested && publicKey && data) void joinRef.current();
  }, [joinRequested, publicKey, data]);
  useEffect(() => {
    if (!fly) return;
    const t = setTimeout(() => setFly(false), FLY_MS);
    return () => clearTimeout(t);
  }, [fly]);

  if (!key || data === null) {
    return (
      <main className="screen">
        <p>{copy.salary.notFound}</p>
      </main>
    );
  }
  if (!data || now === undefined) {
    return (
      <main className="screen">
        <p>{error ? copy.failure.network : copy.common.loading}</p>
      </main>
    );
  }

  const { stream, employer, figures } = data;
  const isEmployer = !!publicKey && publicKey.equals(employer.authority);
  const isEmployee =
    !!publicKey && stream.status !== "invited" && publicKey.equals(stream.employee);
  const hinted = stream.status === "invited" && !stream.employee.equals(PublicKey.default);
  const paydayCome = now >= stream.payday;

  const accounts: HoodAccount[] = [
    { label: "Stream PDA", address: stream.address },
    { label: "Vault (token account, authority = stream PDA)", address: stream.vault },
    { label: "Employer PDA", address: stream.employer },
    { label: "Employer wallet", address: employer.authority },
    ...(stream.employee.equals(PublicKey.default)
      ? []
      : [
          {
            label: stream.status === "invited" ? "Invited wallet (hint)" : "Employee wallet",
            address: stream.employee,
          },
        ]),
    { label: "zł mint (Token-2022)", address: stream.mint },
    ...(publicKey ? [{ label: copy.hood.viewer, address: publicKey }] : []),
  ];
  const hood = (
    <div className="area-hood">
      <UnderTheHood
        {...lastActionHood(action.state)}
        accounts={accounts}
        notes={[copy.hood.readRule, ...(stream.adjustment > 0n ? [copy.hood.capsRule] : [])]}
      />
    </div>
  );
  const title = employeeName ?? copy.employer.salaryNo(stream.id);
  const head = (
    <header className="area-head">
      <p className="eyebrow">{copy.salary.eyebrow(company)}</p>
      <h1>{title}</h1>
      {stream.status === "active" && isEmployer && (
        <p className="note">{copy.salary.youAreEmployer}</p>
      )}
      {stream.status === "active" && !isEmployer && !isEmployee && (
        <p className="note">{copy.salary.youAreGuest}</p>
      )}
    </header>
  );

  if (stream.status === "invited") {
    return (
      <main className="screen invite-screen">
        <h1>{copy.salary.inviteTitle(company)}</h1>
        {isEmployer ? (
          <>
            <p>{copy.salary.employerWaiting}</p>
            <input
              className="invite"
              readOnly
              value={inviteLink(address, company, employeeName)}
              onFocus={(e) => e.target.select()}
            />
          </>
        ) : (
          <>
            <Receipt
              className="ticket"
              lines={[
                {
                  label: copy.salary.inviteNet,
                  value: formatZl(stream.net),
                  strong: true,
                },
                { label: copy.salary.secured, value: formatZl(stream.funded) },
                { label: copy.salary.paydayLabel, value: formatDateTime(stream.payday) },
              ]}
            >
              <p className="small">
                {copy.salary.inviteSecured(formatZl(stream.funded), formatZl(stream.net))}
              </p>
            </Receipt>
            <p>{copy.salary.inviteHow}</p>
            {hinted && publicKey && !publicKey.equals(stream.employee) ? (
              <p className="error">{copy.salary.wrongPerson}</p>
            ) : publicKey ? (
              <button
                className="primary wide"
                disabled={action.state.phase === "pending"}
                onClick={() => void join()}
              >
                {copy.connect.joinConnected}
              </button>
            ) : (
              <span className="wide-wrap" onClickCapture={() => setJoinRequested(true)}>
                <ConnectButton label={copy.connect.join} />
              </span>
            )}
            <Outcome state={action.state} success="" />
          </>
        )}
        {hood}
      </main>
    );
  }

  if (stream.status === "cancelled") {
    return (
      <main className="screen">
        <h1>{copy.salary.cancelledTitle}</h1>
        <p>{copy.salary.cancelledText}</p>
        {hood}
      </main>
    );
  }

  const coupons = stripCoupons({
    earned: stream.status === "settled" ? stream.net : (figures?.earned ?? 0n),
    withdrawn: stream.withdrawn,
    net: stream.net,
    periodStart: stream.periodStart,
    periodEnd: stream.periodEnd,
    endTs: stream.endTs,
    now,
  });

  if (stream.status === "settled") {
    const s = data.settlement;
    return (
      <main className="screen salary">
        {head}
        <div className="area-strip">
          <Strip
            coupons={coupons}
            withdrawn={stream.withdrawn}
            net={stream.net}
            paid
            fly={fly}
            stamp={
              <div className={fly ? "late" : ""}>
                <Stamp kind="paid">{copy.stamps.paid}</Stamp>
              </div>
            }
          />
        </div>
        <div className="area-main">
          {s ? (
            <Receipt
              title={copy.salary.paidReceiptTitle}
              lines={[
                { label: copy.salary.paidEarned, value: formatZl(s.earnedFinal) },
                { label: copy.salary.paidTaken, value: formatZl(stream.withdrawn) },
                stream.endTs !== null && {
                  label: copy.salary.paidEnded,
                  value: formatDateTime(stream.endTs),
                },
                s.cut > 0n && {
                  label: copy.salary.paidCutReason(
                    stream.adjustmentReason,
                    stream.adjustmentAccepted,
                  ),
                  value: `−${formatZl(s.cut)}`,
                },
                {
                  label: copy.salary.paidNow,
                  value: formatZl(s.payEmployee),
                  strong: true,
                  plus: true,
                },
                s.refundEmployer > 0n && {
                  label: copy.salary.paidRefund,
                  value: formatZl(s.refundEmployer),
                },
                s.shortfall > 0n && {
                  label: copy.salary.paidShortfall,
                  value: formatZl(s.shortfall),
                },
                data.inAccount !== null && {
                  label: copy.salary.inAccount,
                  value: formatZl(data.inAccount),
                },
              ]}
            >
              {stream.adjustment > s.cut && (
                <p className="small">{copy.salary.paidCutAsked(formatZl(stream.adjustment))}</p>
              )}
              <ProofLink signature={s.signature} />
            </Receipt>
          ) : (
            <p>{copy.salary.paidLoading}</p>
          )}
        </div>
        {hood}
      </main>
    );
  }

  const runPayday = async () => {
    if (!publicKey) return;
    const outcome = await action.run("settle", async () => [
      await settleIx(
        program,
        publicKey,
        stream.address,
        stream.employer,
        stream.employee,
        employer.authority,
        stream.mint,
      ),
    ]);
    if (outcome.ok) {
      setFly(true);
      reload();
    }
  };

  const takeState =
    action.state.phase !== "idle" && action.state.instruction === "withdraw_earned"
      ? action.state
      : null;
  const refusal =
    takeState?.phase === "done" &&
    !takeState.outcome.ok &&
    takeState.outcome.failure.kind === "program"
      ? takeState
      : null;
  const available = figures?.available ?? null;
  const steps = available !== null ? tearSteps(stream.withdrawn, available, stream.net) : [];
  // Tear mode ends with payday: the take panel is gone, so is the selection.
  const tearing = isEmployee && !paydayCome && tear.mode !== "idle";
  const selected = tearing ? (tear.amountFor(steps) ?? 0n) : 0n;

  const take = async (amount: bigint, mode: "normal" | "tryAnyway") => {
    if (!publicKey) return;
    setLastTaken(amount);
    const outcome = await action.run(
      "withdraw_earned",
      async () => [
        await withdrawEarnedIx(program, publicKey, publicKey, stream.address, stream.mint, amount),
      ],
      mode,
    );
    if (outcome.ok) tear.close();
    reload();
  };

  return (
    <main className="screen salary">
      {head}
      {action.state.phase === "done" && action.state.instruction === "accept_stream" && (
        <Outcome state={action.state} success={copy.salary.joined} />
      )}

      <div className="area-main">
        <section className="hero" aria-label={copy.salary.earned}>
          <p className="hero-label">{copy.salary.earned}</p>
          <p className="hero-amount">{figures ? formatZl(figures.earned) : "…"}</p>
          <div className="hero-row">
            <p className="pill">
              <span>{copy.salary.available}</span>
              <strong>{available !== null ? formatZl(available) : "…"}</strong>
            </p>
            <p className="countdown">
              <span>{paydayCome ? copy.salary.paydayLabel : copy.salary.payday}</span>
              <strong>{paydayCome ? "✓" : formatCountdown(stream.payday - now)}</strong>
            </p>
          </div>
          <aside className="sticky-note">
            <span>{copy.salary.secured}</span>
            <strong>
              <span>{formatZl(stream.funded)}</span> / <span>{formatZl(stream.net)}</span>
            </strong>
            {stream.funded < stream.net && (
              <small>
                {copy.salary.underfunded(formatZl(stream.funded), formatZl(stream.net))}
              </small>
            )}
          </aside>
        </section>

        {paydayCome ? (
          <section className="take-panel">
            <p>{copy.salary.paydayReady}</p>
            {publicKey ? (
              <button
                className="primary wide"
                disabled={action.state.phase === "pending"}
                onClick={() => void runPayday()}
              >
                {copy.salary.runPayday}
              </button>
            ) : (
              <span className="wide-wrap">
                <ConnectButton />
              </span>
            )}
            {/* Only payday's own result here, not a withdrawal still on screen. */}
            {action.state.phase !== "idle" && action.state.instruction === "settle" && (
              <Outcome
                state={action.state}
                success={copy.stamps.paid}
                context={{ payday: stream.payday }}
              />
            )}
          </section>
        ) : isEmployee && publicKey ? (
          <TakePanel
            tear={tear}
            steps={steps}
            available={available}
            withdrawn={stream.withdrawn}
            funded={stream.funded}
            state={takeState}
            lastTaken={lastTaken}
            payday={stream.payday}
            onTake={take}
            onDismiss={() => action.reset()}
          />
        ) : null}

        <div className="area-details">
          <Receipt
            lines={[
              { label: copy.salary.taken, value: formatZl(stream.withdrawn) },
              data.inAccount !== null && {
                label: copy.salary.inAccount,
                value: formatZl(data.inAccount),
              },
              { label: copy.salary.paydayLabel, value: formatDateTime(stream.payday) },
            ]}
          >
            <p className="small">{copy.salary.fromProgram}</p>
          </Receipt>

          {stream.endTs !== null && (
            <p className="note">
              {(isEmployee ? copy.salary.endsOn : copy.salary.endsOnOther)(
                formatDateTime(stream.endTs),
              )}
            </p>
          )}
          {stream.adjustment > 0n && (
            <section className="adjustment">
              <h2>{copy.salary.adjustTitle}</h2>
              <p>
                {(isEmployee ? copy.salary.adjustProposed : copy.salary.adjustProposedOther)(
                  formatZl(stream.adjustment),
                  stream.adjustmentReason,
                )}
              </p>
              {stream.adjustmentAccepted ? (
                <p className="small">
                  {isEmployee ? copy.salary.adjustAccepted : copy.salary.adjustEmployerView(false)}
                </p>
              ) : (
                <>
                  {data.caps &&
                    (stream.adjustment > data.caps.withoutConsent ? (
                      <p className="small">
                        {(isEmployee ? copy.salary.adjustAlone : copy.salary.adjustAloneOther)(
                          formatZl(data.caps.withoutConsent),
                        )}
                      </p>
                    ) : (
                      <p className="small">{copy.salary.adjustWithinFloor}</p>
                    ))}
                  {isEmployee && publicKey && !paydayCome ? (
                    <button
                      className="primary"
                      disabled={action.state.phase === "pending"}
                      onClick={async () => {
                        const outcome = await action.run("accept_adjustment", async () => [
                          await acceptAdjustmentIx(
                            program,
                            publicKey,
                            stream.address,
                            stream.adjustment,
                          ),
                        ]);
                        if (outcome.ok) reload();
                      }}
                    >
                      {copy.salary.adjustAccept(formatZl(stream.adjustment))}
                    </button>
                  ) : (
                    !isEmployee && <p className="small">{copy.salary.adjustEmployerView(true)}</p>
                  )}
                </>
              )}
              {action.state.phase !== "idle" &&
                action.state.instruction === "accept_adjustment" && (
                  <Outcome state={action.state} success={copy.salary.adjustAcceptedNow} />
                )}
            </section>
          )}
        </div>
      </div>

      <div className="area-strip">
        <Strip
          coupons={coupons}
          withdrawn={stream.withdrawn}
          net={stream.net}
          selected={selected}
          onPick={
            tearing && tear.mode === "tear"
              ? (i) => tear.pick(i - takenWhole(stream.withdrawn, stream.net) + 1, steps.length)
              : undefined
          }
          stamp={
            refusal && refusal.phase === "done" && !refusal.outcome.ok ? (
              <>
                <Stamp kind="refused">{copy.stamps.refused}</Stamp>
                <p className="stamp-reason" role="alert">
                  {failureSentence(refusal.outcome.failure, { payday: stream.payday })}
                </p>
                {refusal.outcome.signature && <ProofLink signature={refusal.outcome.signature} />}
              </>
            ) : undefined
          }
        />
      </div>
      {hood}
    </main>
  );
}
