import type { PublicKey } from "@solana/web3.js";

import { PROGRAM_ID, explorerAddress, explorerTx } from "../chain/config";
import { copy } from "../copy";

export type HoodAccount = { label: string; address: PublicKey | string };

type Props = {
  instruction?: string;
  accounts?: HoodAccount[];
  signature?: string | null;
  failed?: boolean;
  errorCode?: string | null;
  notes?: string[];
};

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** Technical details for the jury: instruction, rule, accounts and Explorer links. */
export function UnderTheHood({
  instruction,
  accounts = [],
  signature,
  failed,
  errorCode,
  notes = [],
}: Props) {
  const all: HoodAccount[] = [{ label: copy.hood.program, address: PROGRAM_ID }, ...accounts];
  return (
    <details className="hood">
      <summary>{copy.hood.title}</summary>
      <dl>
        {instruction && (
          <>
            <dt>{copy.hood.instruction}</dt>
            <dd>
              <code>{instruction}</code>
            </dd>
            {copy.hood.rules[instruction] && (
              <>
                <dt>{copy.hood.rule}</dt>
                <dd>{copy.hood.rules[instruction]}</dd>
              </>
            )}
          </>
        )}
        {signature && (
          <>
            <dt>{failed ? copy.hood.failedTx : copy.hood.lastTx}</dt>
            <dd>
              <a href={explorerTx(signature)} target="_blank" rel="noreferrer">
                <code>{short(signature)}</code> ↗
              </a>
            </dd>
          </>
        )}
        {errorCode && (
          <>
            <dt>{copy.hood.errorCode}</dt>
            <dd>
              <code>{errorCode}</code>
            </dd>
          </>
        )}
        <dt>{copy.hood.accounts}</dt>
        <dd>
          <ul>
            {all.map(({ label, address }) => (
              <li key={label}>
                {label}:{" "}
                <a href={explorerAddress(address)} target="_blank" rel="noreferrer">
                  <code>{short(address.toString())}</code> ↗
                </a>
              </li>
            ))}
          </ul>
        </dd>
      </dl>
      {[...notes, copy.hood.fees].map((n) => (
        <p key={n} className="hood-note">
          {n}
        </p>
      ))}
    </details>
  );
}
