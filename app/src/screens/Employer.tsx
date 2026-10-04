import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { type ReactNode, useState } from "react";

import { DEFAULT_FLOOR_BPS, POLL_MS, ZL_MINT } from "../chain/config";
import {
  cancelUnacceptedIx,
  createStreamIx,
  employerPda,
  endEmploymentIx,
  fundStreamIx,
  initEmployerIx,
  proposeAdjustmentIx,
  streamPda,
  zlAccount,
} from "../chain/program";
import {
  type StreamView,
  clusterNow,
  fetchEmployer,
  fetchStreams,
  programCutCaps,
  zlBalance,
} from "../chain/view";
import { ConnectButton } from "../components/ConnectButton";
import { Outcome } from "../components/Outcome";
import { UnderTheHood } from "../components/UnderTheHood";
import { copy } from "../copy";
import { formatDateTime, formatZl, fromWarsawInput, parseZl, toWarsawInput } from "../format";
import { lastActionHood, useAction, useClusterNow, usePoll, useProgram } from "../hooks";
import { readLabels, saveLabel } from "../labels";
import { inviteLink } from "../route";

const companyKey = (authority: PublicKey) => `dniowka:company:${authority.toBase58()}`;

function readCompany(authority: PublicKey): string | null {
  try {
    return localStorage.getItem(companyKey(authority));
  } catch {
    return null;
  }
}

export function Employer() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const program = useProgram();
  const action = useAction();
  const [message, setMessage] = useState<string>("");
  /** Which salary the last action was about, so its result shows on that row. */
  const [target, setTarget] = useState<string | null>(null);

  const { data, reload } = usePoll(
    async () => {
      if (!publicKey) return null;
      const [employer, balance, now] = await Promise.all([
        fetchEmployer(program, publicKey),
        zlBalance(connection, ZL_MINT, publicKey),
        clusterNow(connection),
      ]);
      const streams = employer ? await fetchStreams(program, employer) : [];
      return { employer, balance, now, streams };
    },
    POLL_MS * 2,
    [publicKey?.toBase58(), program],
  );
  const now = useClusterNow(data?.now);

  if (!publicKey) {
    return (
      <main className="screen">
        <h1>{copy.employer.title}</h1>
        <p>{copy.employer.connectFirst}</p>
        <ConnectButton />
      </main>
    );
  }
  if (!data || now === undefined) {
    return (
      <main className="screen">
        <h1>{copy.employer.title}</h1>
        <p>{copy.common.loading}</p>
      </main>
    );
  }

  const company = readCompany(publicKey);
  const hood = (
    <UnderTheHood
      {...lastActionHood(action.state)}
      accounts={[
        { label: copy.hood.viewer, address: publicKey },
        { label: "Employer PDA", address: employerPda(publicKey) },
        { label: "zł mint (Token-2022)", address: ZL_MINT },
        { label: "Employer zł account", address: zlAccount(ZL_MINT, publicKey) },
      ]}
    />
  );

  if (!data.employer) {
    return (
      <main className="screen">
        <h1>{copy.employer.registerTitle}</h1>
        <RegisterForm
          busy={action.state.phase === "pending"}
          onSubmit={async (name) => {
            try {
              localStorage.setItem(companyKey(publicKey), name);
            } catch {
              // optional label
            }
            setMessage(copy.employer.registered);
            const outcome = await action.run("init_employer", async () => [
              await initEmployerIx(program, publicKey, ZL_MINT, DEFAULT_FLOOR_BPS),
            ]);
            if (outcome.ok) reload();
          }}
        />
        <Outcome state={action.state} success={copy.employer.registered} />
        {hood}
      </main>
    );
  }

  const employer = data.employer;
  const labels = readLabels();

  return (
    <main className="screen">
      <h1>{company ?? copy.employer.title}</h1>
      <p className="balance">
        {copy.employer.balance}: <strong>{formatZl(data.balance)}</strong>
      </p>
      {data.balance === 0n && <p className="note">{copy.employer.noMoney}</p>}
      <p>
        <a className="secondary" href={`#/screen/${publicKey.toBase58()}`}>
          {copy.employer.bigScreen}
        </a>
      </p>

      {target === null && <Outcome state={action.state} success={message} />}

      <section>
        <h2>{copy.employer.addTitle}</h2>
        <AddEmployeeForm
          defaultFloorBps={employer.defaultFloorBps}
          busy={action.state.phase === "pending"}
          onSubmit={async (form) => {
            // Fresh reads: the next stream id and the cluster clock.
            const [fresh, now] = await Promise.all([
              fetchEmployer(program, publicKey),
              clusterNow(connection),
            ]);
            if (!fresh) return false;
            const day = Math.floor(form.lengthSeconds / 30);
            const periodStart = now - form.worked * day;
            const periodEnd = periodStart + form.lengthSeconds;
            const stream = streamPda(fresh.address, fresh.streamCount);
            setMessage(copy.employer.created(form.name));
            setTarget(null);
            const outcome = await action.run("create_stream", async () => [
              await createStreamIx(program, publicKey, fresh.mint, fresh.streamCount, {
                employeeHint: form.lockTo,
                net: form.net,
                periodStart,
                periodEnd,
                payday: periodEnd + form.paydayDelay * day,
                floorBps: form.floorBps,
              }),
            ]);
            if (outcome.ok) {
              saveLabel(stream.toBase58(), form.name);
              reload();
            }
            return outcome.ok;
          }}
        />
      </section>

      <section>
        <h2>{copy.employer.listTitle}</h2>
        {data.streams.length === 0 && <p>{copy.employer.empty}</p>}
        <ul className="rows">
          {data.streams.map((s) => (
            <StreamRow
              key={s.address.toBase58()}
              stream={s}
              now={now}
              name={labels[s.address.toBase58()] ?? null}
              company={company}
              busy={action.state.phase === "pending"}
              outcome={
                target === s.address.toBase58() ? (
                  <Outcome state={action.state} success={message} />
                ) : null
              }
              loadCaps={() => programCutCaps(program, s, publicKey)}
              onSecure={async (amount) => {
                setMessage(copy.employer.secured(formatZl(amount)));
                setTarget(s.address.toBase58());
                const outcome = await action.run("fund_stream", async () => [
                  await fundStreamIx(program, publicKey, s.address, employer.mint, amount),
                ]);
                if (outcome.ok) reload();
              }}
              onEnd={async (endTs, mode) => {
                setMessage(copy.employer.ended(formatDateTime(endTs)));
                setTarget(s.address.toBase58());
                const outcome = await action.run(
                  "end_employment",
                  async () => [await endEmploymentIx(program, publicKey, s.address, endTs)],
                  mode,
                );
                if (outcome.ok) reload();
              }}
              onAdjust={async (amount, reason) => {
                setMessage(copy.employer.proposed(formatZl(amount)));
                setTarget(s.address.toBase58());
                const outcome = await action.run("propose_adjustment", async () => [
                  await proposeAdjustmentIx(program, publicKey, s.address, amount, reason),
                ]);
                if (outcome.ok) reload();
                return outcome.ok;
              }}
              onCancel={async () => {
                setMessage(copy.employer.cancelled);
                setTarget(s.address.toBase58());
                const outcome = await action.run("cancel_unaccepted", async () => [
                  await cancelUnacceptedIx(program, publicKey, s.address, employer.mint),
                ]);
                if (outcome.ok) reload();
              }}
            />
          ))}
        </ul>
      </section>
      {hood}
    </main>
  );
}

function RegisterForm({ busy, onSubmit }: { busy: boolean; onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <label>
        {copy.employer.companyName}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.employer.companyPlaceholder}
          required
        />
      </label>
      <button className="primary" disabled={busy || !name.trim()}>
        {copy.employer.register}
      </button>
    </form>
  );
}

type NewSalary = {
  name: string;
  net: bigint;
  floorBps: number;
  lengthSeconds: number;
  worked: number;
  paydayDelay: number;
  lockTo: PublicKey | null;
};

function AddEmployeeForm({
  defaultFloorBps,
  busy,
  onSubmit,
}: {
  defaultFloorBps: number;
  busy: boolean;
  onSubmit: (s: NewSalary) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [net, setNet] = useState("6000");
  const [floor, setFloor] = useState(String(defaultFloorBps / 100));
  const [length, setLength] = useState(String(copy.employer.lengths[0].seconds));
  const [worked, setWorked] = useState("0");
  const [delay, setDelay] = useState("0");
  const [lockTo, setLockTo] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const grosze = parseZl(net);
    if (!grosze || grosze <= 0n) return setError(copy.employer.invalidAmount);
    let lock: PublicKey | null = null;
    if (lockTo.trim()) {
      try {
        lock = new PublicKey(lockTo.trim());
      } catch {
        return setError(copy.employer.invalidLock);
      }
    }
    setError("");
    void onSubmit({
      name: name.trim() || "—",
      net: grosze,
      // The program checks 1..=10 000; the form only converts % to basis points.
      floorBps: Math.round(Number(floor.replace(",", ".")) * 100),
      lengthSeconds: Number(length),
      worked: Math.max(0, Math.min(29, Number(worked) || 0)),
      paydayDelay: Math.max(0, Math.min(10, Number(delay) || 0)),
      lockTo: lock,
    }).then((ok) => {
      if (ok) {
        setName("");
        setLockTo("");
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label>
        {copy.employer.employeeName}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.employer.employeePlaceholder}
        />
      </label>
      <label>
        {copy.employer.net}
        <input value={net} onChange={(e) => setNet(e.target.value)} inputMode="decimal" />
      </label>
      <label>
        {copy.employer.floor}
        <input value={floor} onChange={(e) => setFloor(e.target.value)} inputMode="decimal" />
      </label>
      <label>
        {copy.employer.monthLength}
        <select value={length} onChange={(e) => setLength(e.target.value)}>
          {copy.employer.lengths.map((l) => (
            <option key={l.seconds} value={l.seconds}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.employer.worked}
        <input
          value={worked}
          onChange={(e) => setWorked(e.target.value)}
          inputMode="numeric"
          type="number"
          min={0}
          max={29}
        />
      </label>
      <label>
        {copy.employer.paydayDelay}
        <input
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          inputMode="numeric"
          type="number"
          min={0}
          max={10}
        />
      </label>
      <label>
        {copy.employer.lockTo}
        <input value={lockTo} onChange={(e) => setLockTo(e.target.value)} spellCheck={false} />
        <small>{copy.employer.lockToHint}</small>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {copy.employer.create}
      </button>
    </form>
  );
}

type CutCaps = Awaited<ReturnType<typeof programCutCaps>>;

function StreamRow({
  stream: s,
  now,
  name,
  company,
  busy,
  outcome,
  loadCaps,
  onSecure,
  onEnd,
  onAdjust,
  onCancel,
}: {
  stream: StreamView;
  now: number;
  name: string | null;
  company: string | null;
  busy: boolean;
  outcome: ReactNode;
  loadCaps: () => Promise<CutCaps>;
  onSecure: (amount: bigint) => void;
  onEnd: (endTs: number, mode: "normal" | "tryAnyway") => void;
  onAdjust: (amount: bigint, reason: number) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const address = s.address.toBase58();
  const link = inviteLink(address, company, name);
  const missing = s.net - s.funded;
  const beforePayday = now < s.payday;
  const canSecure =
    missing > 0n && (s.status === "invited" || s.status === "active") && beforePayday;
  const canManage = s.status === "active" && beforePayday;

  return (
    <li className="row">
      <div className="row-head">
        <strong>{name ?? copy.employer.salaryNo(s.id)}</strong>
        <span className={`status status-${s.status}`}>{copy.status[s.status]}</span>
      </div>
      <dl className="figures">
        <dt>{copy.salary.secured}</dt>
        <dd>
          <span>{formatZl(s.funded)}</span> / <span>{formatZl(s.net)}</span>
        </dd>
        <dt>{copy.salary.taken}</dt>
        <dd>{formatZl(s.withdrawn)}</dd>
        <dt>{copy.salary.paydayLabel}</dt>
        <dd>{formatDateTime(s.payday)}</dd>
      </dl>
      {s.endTs !== null && <p className="small">{copy.employer.endsOn(formatDateTime(s.endTs))}</p>}
      {s.adjustment > 0n && (
        <p className="small">
          {copy.employer.adjustment(formatZl(s.adjustment), s.adjustmentReason)} ·{" "}
          {s.adjustmentAccepted
            ? copy.employer.adjustmentAccepted
            : copy.employer.adjustmentWaiting}
        </p>
      )}
      <div className="row-actions">
        {canSecure && (
          <button className="primary" disabled={busy} onClick={() => onSecure(missing)}>
            {copy.employer.secure(formatZl(missing))}
          </button>
        )}
        {s.status === "invited" && (
          <button
            className="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => setCopied(true));
            }}
          >
            {copied ? copy.common.copied : copy.common.copyLink}
          </button>
        )}
        {canManage && (
          <button className="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? copy.employer.manageClose : copy.employer.manage}
          </button>
        )}
        <a className="secondary" href={`#/s/${address}${link.split(address)[1] ?? ""}`}>
          {copy.employer.open}
        </a>
      </div>
      {s.status === "invited" && (
        <>
          <input className="invite" readOnly value={link} onFocus={(e) => e.target.select()} />
          {/* Always offered: the program alone decides whether the grace period is over. */}
          <button className="quiet" disabled={busy} onClick={onCancel}>
            {s.funded > 0n ? copy.employer.cancel(formatZl(s.funded)) : copy.employer.cancelEmpty}
          </button>
        </>
      )}
      {canManage && open && (
        <div className="manage">
          <EndEmploymentForm stream={s} now={now} busy={busy} onEnd={onEnd} />
          <AdjustmentForm stream={s} busy={busy} loadCaps={loadCaps} onAdjust={onAdjust} />
        </div>
      )}
      {outcome}
    </li>
  );
}

/**
 * The picker refuses the past (min = cluster now) but the program is what enforces it:
 * a past date can still be sent with "Try anyway" and is refused on-chain.
 */
function EndEmploymentForm({
  stream: s,
  now,
  busy,
  onEnd,
}: {
  stream: StreamView;
  now: number;
  busy: boolean;
  onEnd: (endTs: number, mode: "normal" | "tryAnyway") => void;
}) {
  const [value, setValue] = useState("");
  const endTs = fromWarsawInput(value);
  const problem =
    endTs === null
      ? null
      : endTs < now
        ? copy.employer.endPast
        : endTs > s.periodEnd
          ? copy.employer.endAfterMonth
          : s.endTs !== null && endTs <= s.endTs
            ? copy.employer.endBeforeCurrent(formatDateTime(s.endTs))
            : null;
  const minTs = s.endTs !== null ? Math.max(now, s.endTs + 1) : now;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (endTs !== null && !problem) onEnd(endTs, "normal");
      }}
    >
      <h3>{copy.employer.endTitle}</h3>
      <label>
        {copy.employer.endDate}
        <input
          type="datetime-local"
          step={1}
          value={value}
          min={toWarsawInput(minTs)}
          max={toWarsawInput(s.periodEnd)}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <small>{copy.employer.endExplain}</small>
      {problem && <p className="error">{problem}</p>}
      <button className="primary" disabled={busy || endTs === null || problem !== null}>
        {copy.employer.end}
      </button>
      {endTs !== null && endTs < now && (
        <button
          type="button"
          className="danger"
          disabled={busy}
          title={copy.salary.tryAnywayHint}
          onClick={() => onEnd(endTs, "tryAnyway")}
        >
          {copy.salary.tryAnyway}
        </button>
      )}
    </form>
  );
}

function AdjustmentForm({
  stream: s,
  busy,
  loadCaps,
  onAdjust,
}: {
  stream: StreamView;
  busy: boolean;
  loadCaps: () => Promise<CutCaps>;
  onAdjust: (amount: bigint, reason: number) => Promise<boolean>;
}) {
  const [reason, setReason] = useState(String(copy.employer.reasons[0].code));
  const [text, setText] = useState("");
  // The limits come from the program (simulated proposal), re-read with each poll.
  const { data: caps } = usePoll(loadCaps, POLL_MS, [
    s.address.toBase58(),
    s.withdrawn.toString(),
    String(s.endTs),
  ]);
  const amount = parseZl(text);
  const overCap = amount !== null && caps ? amount > caps.withConsent : false;
  const needsConsent = amount !== null && caps ? amount > caps.withoutConsent : false;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (amount === null || amount === 0n || overCap) return;
        if (await onAdjust(amount, Number(reason))) setText("");
      }}
    >
      <h3>{copy.employer.adjustTitle}</h3>
      <p className="small">
        {caps
          ? copy.employer.caps(formatZl(caps.withoutConsent), formatZl(caps.withConsent))
          : copy.employer.capsLoading}
      </p>
      <label>
        {copy.employer.reason}
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {copy.employer.reasons.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.employer.adjustAmount}
        <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" />
      </label>
      {caps && overCap && (
        <p className="error">{copy.employer.overCap(formatZl(caps.withConsent))}</p>
      )}
      {caps && needsConsent && !overCap && (
        <p className="note">{copy.employer.needsConsent(formatZl(caps.withoutConsent))}</p>
      )}
      <button className="primary" disabled={busy || amount === null || amount === 0n || overCap}>
        {copy.employer.propose}
      </button>
    </form>
  );
}
