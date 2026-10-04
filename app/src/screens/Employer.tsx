import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState } from "react";

import { DEFAULT_FLOOR_BPS, POLL_MS, ZL_MINT } from "../chain/config";
import {
  createStreamIx,
  employerPda,
  fundStreamIx,
  initEmployerIx,
  streamPda,
  zlAccount,
} from "../chain/program";
import { type StreamView, clusterNow, fetchEmployer, fetchStreams, zlBalance } from "../chain/view";
import { ConnectButton } from "../components/ConnectButton";
import { Outcome } from "../components/Outcome";
import { UnderTheHood } from "../components/UnderTheHood";
import { copy } from "../copy";
import { formatDateTime, formatZl, parseZl } from "../format";
import { lastActionHood, useAction, usePoll, useProgram } from "../hooks";
import { inviteLink } from "../route";

const labelsKey = "dniowka:labels";
const companyKey = (authority: PublicKey) => `dniowka:company:${authority.toBase58()}`;

/** Off-chain labels on the employer's own device (names never go on-chain). */
function readLabels(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(labelsKey) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function saveLabel(stream: string, name: string) {
  try {
    localStorage.setItem(labelsKey, JSON.stringify({ ...readLabels(), [stream]: name }));
  } catch {
    // labels are a convenience only
  }
}
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

  if (!publicKey) {
    return (
      <main className="screen">
        <h1>{copy.employer.title}</h1>
        <p>{copy.employer.connectFirst}</p>
        <ConnectButton />
      </main>
    );
  }
  if (!data) {
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

      <Outcome state={action.state} success={message} />

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
              now={data.now}
              name={labels[s.address.toBase58()] ?? null}
              company={company}
              busy={action.state.phase === "pending"}
              onSecure={async (amount) => {
                setMessage(copy.employer.secured(formatZl(amount)));
                const outcome = await action.run("fund_stream", async () => [
                  await fundStreamIx(program, publicKey, s.address, employer.mint, amount),
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

function StreamRow({
  stream: s,
  now,
  name,
  company,
  busy,
  onSecure,
}: {
  stream: StreamView;
  now: number;
  name: string | null;
  company: string | null;
  busy: boolean;
  onSecure: (amount: bigint) => void;
}) {
  const [copied, setCopied] = useState(false);
  const address = s.address.toBase58();
  const link = inviteLink(address, company, name);
  const missing = s.net - s.funded;
  const canSecure =
    missing > 0n && (s.status === "invited" || s.status === "active") && now < s.payday;

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
        <a className="secondary" href={`#/s/${address}${link.split(address)[1] ?? ""}`}>
          {copy.employer.open}
        </a>
      </div>
      {s.status === "invited" && (
        <input className="invite" readOnly value={link} onFocus={(e) => e.target.select()} />
      )}
    </li>
  );
}
