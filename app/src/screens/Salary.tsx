import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { type ReactNode, useEffect, useRef, useState } from "react";

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
import { Stamp } from "../components/Stamp";
import { Strip } from "../components/Strip";
import { type HoodAccount, UnderTheHood } from "../components/UnderTheHood";
import { copy } from "../copy";
import { formatCountdown, formatDateTime, formatZl, parseZl } from "../format";
import { lastActionHood, useAction, useClusterNow, usePoll, useProgram } from "../hooks";
import { inviteLink } from "../route";

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
    <UnderTheHood
      {...lastActionHood(action.state)}
      accounts={accounts}
      notes={[copy.hood.readRule, ...(stream.adjustment > 0n ? [copy.hood.capsRule] : [])]}
    />
  );
  const title = employeeName ?? copy.employer.salaryNo(stream.id);

  if (stream.status === "invited") {
    const outcome =
      action.state.phase === "done" ? <Outcome state={action.state} success="" /> : null;
    return (
      <main className="screen">
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
            <p className="big">{formatZl(stream.net)}</p>
            <p>{copy.salary.inviteSecured(formatZl(stream.funded), formatZl(stream.net))}</p>
            <p>{copy.salary.inviteHow}</p>
            {hinted && publicKey && !publicKey.equals(stream.employee) ? (
              <p className="error">{copy.salary.wrongPerson}</p>
            ) : publicKey ? (
              <button
                className="primary"
                disabled={action.state.phase === "pending"}
                onClick={() => void join()}
              >
                {copy.connect.joinConnected}
              </button>
            ) : (
              <span onClickCapture={() => setJoinRequested(true)}>
                <ConnectButton label={copy.connect.join} />
              </span>
            )}
            {action.state.phase === "pending" && <Outcome state={action.state} success="" />}
            {outcome}
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

  if (stream.status === "settled") {
    const s = data.settlement;
    return (
      <main className="screen">
        <h1>{title}</h1>
        <Stamp kind="paid">{copy.stamps.paid}</Stamp>
        {s ? (
          <section className="receipt">
            <dl className="figures">
              <dt>{copy.salary.paidEarned}</dt>
              <dd>{formatZl(s.earnedFinal)}</dd>
              <dt>{copy.salary.paidTaken}</dt>
              <dd>{formatZl(stream.withdrawn)}</dd>
              {stream.endTs !== null && (
                <>
                  <dt>{copy.salary.paidEnded}</dt>
                  <dd>{formatDateTime(stream.endTs)}</dd>
                </>
              )}
              {s.cut > 0n && (
                <>
                  <dt>
                    {copy.salary.paidCutReason(stream.adjustmentReason, stream.adjustmentAccepted)}
                  </dt>
                  <dd>−{formatZl(s.cut)}</dd>
                </>
              )}
              <dt>{copy.salary.paidNow}</dt>
              <dd className="strong">{formatZl(s.payEmployee)}</dd>
              {s.refundEmployer > 0n && (
                <>
                  <dt>{copy.salary.paidRefund}</dt>
                  <dd>{formatZl(s.refundEmployer)}</dd>
                </>
              )}
              {s.shortfall > 0n && (
                <>
                  <dt>{copy.salary.paidShortfall}</dt>
                  <dd>{formatZl(s.shortfall)}</dd>
                </>
              )}
              {data.inAccount !== null && (
                <>
                  <dt>{copy.salary.inAccount}</dt>
                  <dd>{formatZl(data.inAccount)}</dd>
                </>
              )}
            </dl>
            {stream.adjustment > s.cut && (
              <p className="small">{copy.salary.paidCutAsked(formatZl(stream.adjustment))}</p>
            )}
            <ProofLink signature={s.signature} />
          </section>
        ) : (
          <p>{copy.salary.paidLoading}</p>
        )}
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
    if (outcome.ok) reload();
  };

  return (
    <main className="screen">
      <h1>{title}</h1>
      {isEmployer && <p className="note">{copy.salary.youAreEmployer}</p>}
      {!isEmployer && !isEmployee && <p className="note">{copy.salary.youAreGuest}</p>}
      {action.state.phase === "done" && action.state.instruction === "accept_stream" && (
        <Outcome state={action.state} success={copy.salary.joined} />
      )}

      <dl className="figures hero">
        <dt>{copy.salary.earned}</dt>
        <dd className="big">{figures ? formatZl(figures.earned) : "…"}</dd>
        <dt>{copy.salary.available}</dt>
        <dd className="pill">{figures ? formatZl(figures.available) : "…"}</dd>
        <dt>{copy.salary.secured}</dt>
        <dd>
          <span>{formatZl(stream.funded)}</span> / <span>{formatZl(stream.net)}</span>
        </dd>
        <dt>{copy.salary.taken}</dt>
        <dd>{formatZl(stream.withdrawn)}</dd>
        {data.inAccount !== null && (
          <>
            <dt>{copy.salary.inAccount}</dt>
            <dd>{formatZl(data.inAccount)}</dd>
          </>
        )}
        <dt>{paydayCome ? copy.salary.paydayAt(stream.payday) : copy.salary.payday}</dt>
        <dd>{paydayCome ? "✓" : formatCountdown(stream.payday - now)}</dd>
      </dl>
      {stream.funded < stream.net && (
        <p className="note">
          {copy.salary.underfunded(formatZl(stream.funded), formatZl(stream.net))}
        </p>
      )}
      <p className="small">{copy.salary.fromProgram}</p>

      <Strip earned={figures?.earned ?? 0n} withdrawn={stream.withdrawn} net={stream.net} />

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
          {action.state.phase !== "idle" && action.state.instruction === "accept_adjustment" && (
            <Outcome state={action.state} success={copy.salary.adjustAcceptedNow} />
          )}
        </section>
      )}

      {paydayCome ? (
        <section>
          <p>{copy.salary.paydayReady}</p>
          {publicKey ? (
            <button
              className="primary"
              disabled={action.state.phase === "pending"}
              onClick={() => void runPayday()}
            >
              {copy.salary.runPayday}
            </button>
          ) : (
            <ConnectButton />
          )}
          <Outcome
            state={action.state}
            success={copy.stamps.paid}
            context={{ payday: stream.payday }}
          />
        </section>
      ) : isEmployee && publicKey ? (
        <TakeMoney
          available={figures?.available ?? null}
          busy={action.state.phase === "pending"}
          onTake={async (amount, mode) => {
            setLastTaken(amount);
            const outcome = await action.run(
              "withdraw_earned",
              async () => [
                await withdrawEarnedIx(
                  program,
                  publicKey,
                  publicKey,
                  stream.address,
                  stream.mint,
                  amount,
                ),
              ],
              mode,
            );
            reload();
            return outcome.ok;
          }}
          outcome={
            action.state.phase !== "idle" && action.state.instruction === "withdraw_earned" ? (
              <Outcome
                state={action.state}
                success={
                  action.state.phase === "done" && action.state.outcome.ok
                    ? copy.salary.took(formatZl(lastTaken))
                    : ""
                }
                context={{ payday: stream.payday }}
              />
            ) : null
          }
        />
      ) : null}
      <p className="small">{copy.salary.paydayAt(stream.payday)}</p>
      {hood}
    </main>
  );
}

function TakeMoney({
  available,
  busy,
  onTake,
  outcome,
}: {
  available: bigint | null;
  busy: boolean;
  onTake: (amount: bigint, mode: "normal" | "tryAnyway") => Promise<boolean>;
  outcome: ReactNode;
}) {
  const [text, setText] = useState("");
  const amount = parseZl(text);
  // A hint only: the program decides, and "Try anyway" lets it refuse on-chain.
  const tooMuch = amount !== null && available !== null && amount > available;

  return (
    <section className="take">
      <h2>{copy.salary.takeTitle}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (amount === null || tooMuch) return;
          if (await onTake(amount, "normal")) setText("");
        }}
      >
        <label>
          {copy.salary.amount}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode="decimal"
            placeholder={available !== null ? formatZl(available).replace(/\u00a0zł$/, "") : ""}
          />
        </label>
        {tooMuch && <p className="error">{copy.salary.tooMuch}</p>}
        <button className="primary" disabled={busy || amount === null || amount === 0n || tooMuch}>
          {copy.salary.take}
        </button>
        {tooMuch && amount !== null && (
          <button
            type="button"
            className="danger"
            disabled={busy}
            title={copy.salary.tryAnywayHint}
            onClick={() => void onTake(amount, "tryAnyway")}
          >
            {copy.salary.tryAnyway}
          </button>
        )}
      </form>
      {outcome}
    </section>
  );
}
