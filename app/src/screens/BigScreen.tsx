import { TOKEN_2022_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useMemo, useRef } from "react";

import { POLL_MS, RPC_URL } from "../chain/config";
import { type FeedEntry, FeedReader } from "../chain/feed";
import { makeProgram } from "../chain/program";
import { type StreamView, clusterNow, fetchEmployer, fetchStreams } from "../chain/view";
import { ProofLink } from "../components/ProofLink";
import { UnderTheHood } from "../components/UnderTheHood";
import { copy } from "../copy";
import { formatCountdown, formatDateTime, formatZl, toWarsawInput } from "../format";
import { useClusterNow, usePoll, useProgram } from "../hooks";
import { readLabels } from "../labels";

type Loaded = {
  streams: StreamView[];
  inVaults: bigint;
  now: number;
} | null;

const FEED_MS = 8_000;

function toKey(s: string): PublicKey | null {
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

/** Demo screen (1280×720): vault total, payday countdown and the program's live events. */
export function BigScreen({ authority }: { authority: string }) {
  const key = toKey(authority);
  const { connection } = useConnection();
  const program = useProgram();
  // The feed reads many transactions: its own connection fails fast on a rate limit
  // (and tries again next refresh) instead of retrying in a burst.
  const feedProgram = useMemo(
    () =>
      makeProgram(
        new Connection(RPC_URL, { commitment: "confirmed", disableRetryOnRateLimit: true }),
      ),
    [],
  );
  const reader = useRef<FeedReader | null>(null);

  const { data, error } = usePoll<Loaded>(
    async () => {
      if (!key) return null;
      const employer = await fetchEmployer(program, key);
      if (!employer) return null;
      const streams = await fetchStreams(program, employer);
      const [vaults, now] = await Promise.all([
        connection.getMultipleAccountsInfo(
          streams.map((s) => s.vault),
          "confirmed",
        ),
        clusterNow(connection),
      ]);
      // Real vault balances, read from the token accounts themselves.
      const inVaults = vaults.reduce(
        (sum, info, i) =>
          info ? sum + unpackAccount(streams[i].vault, info, TOKEN_2022_PROGRAM_ID).amount : sum,
        0n,
      );
      return { streams, inVaults, now };
    },
    POLL_MS + 2_000,
    [authority, program],
  );
  const watchedKey = (data?.streams ?? []).map((s) => s.address.toBase58()).join(",");
  const { data: feed = [] } = usePoll<FeedEntry[]>(
    async () => {
      if (!watchedKey) return [];
      reader.current ??= new FeedReader(feedProgram);
      const watched = new Set(watchedKey.split(","));
      return reader.current.refresh((s) => watched.has(s));
    },
    FEED_MS,
    [watchedKey, feedProgram],
  );
  const now = useClusterNow(data?.now);

  if (data === null) {
    return (
      <main className="big-screen">
        <p className="bs-empty">{copy.bigScreen.unknownEmployer}</p>
      </main>
    );
  }
  if (!data || now === undefined) {
    return (
      <main className="big-screen">
        <p className="bs-empty">{error ? copy.failure.network : copy.common.loading}</p>
      </main>
    );
  }

  const running = data.streams.filter((s) => s.status === "active" || s.status === "invited");
  const dueNow = running.some((s) => s.status === "active" && s.payday <= now);
  const upcoming = running.filter((s) => s.payday > now).map((s) => s.payday);
  const next = upcoming.length ? Math.min(...upcoming) : null;

  const labels = readLabels();
  const ids = new Map(data.streams.map((s) => [s.address.toBase58(), s.id]));
  const who = (stream: string) =>
    labels[stream] ??
    (ids.has(stream) ? copy.bigScreen.employeeNo(ids.get(stream)!) : `${stream.slice(0, 4)}…`);

  return (
    <main className="big-screen">
      <section className="bs-left">
        <p className="bs-label">{copy.bigScreen.vault}</p>
        <p className="bs-total">{formatZl(data.inVaults)}</p>
        <p className="bs-label">
          {dueNow
            ? copy.bigScreen.paydayNow
            : next
              ? copy.bigScreen.nextPayday
              : copy.bigScreen.noPayday}
        </p>
        {!dueNow && next !== null && <p className="bs-countdown">{formatCountdown(next - now)}</p>}
      </section>

      <section className="bs-receipt" aria-live="polite">
        <h2>{copy.bigScreen.feedTitle}</h2>
        {feed.length === 0 && <p>{copy.bigScreen.feedEmpty}</p>}
        <ol>
          {feed.map((e, i) => (
            <li key={`${e.signature}-${i}`} className={`bs-line bs-${e.kind}`}>
              <span className="bs-time">{e.time ? toWarsawInput(e.time).slice(11) : ""}</span>
              <span className="bs-text">
                <span>{lineText(e, who(e.stream))}</span>
              </span>
              <ProofLink signature={e.signature} />
            </li>
          ))}
        </ol>
      </section>

      <footer className="bs-bottom">
        {copy.bigScreen.integrations.map((i) => (
          <span key={i.label} className={i.on ? "bs-tag on" : "bs-tag"}>
            {i.label}
          </span>
        ))}
        <UnderTheHood notes={[copy.hood.feedRule]} />
      </footer>
    </main>
  );
}

function lineText(e: FeedEntry, name: string): string {
  const l = copy.bigScreen.line;
  switch (e.kind) {
    case "created":
      return l.created(name, formatZl(e.net));
    case "funded":
      return l.funded(name, formatZl(e.amount));
    case "joined":
      return l.joined(name);
    case "took":
      return l.took(name, formatZl(e.amount));
    case "ended":
      return l.ended(name, formatDateTime(e.endTs));
    case "proposed":
      return l.proposed(name, formatZl(e.amount), e.reason);
    case "accepted":
      return l.accepted(name, formatZl(e.amount));
    case "paid":
      return e.refund > 0n
        ? `${l.paid(name, formatZl(e.pay))} · ${l.paidRefund(formatZl(e.refund))}`
        : l.paid(name, formatZl(e.pay));
    case "shortfall":
      return l.shortfall(name, formatZl(e.amount));
    case "cancelled":
      return l.cancelled(name, formatZl(e.refund));
    case "refused":
      return `${copy.stamps.refused} · ${copy.failure.program(e.error, e)}`;
  }
}
