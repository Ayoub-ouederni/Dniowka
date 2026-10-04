import { explorerTx } from "../chain/config";
import { copy } from "../copy";

/** Small Explorer link for the jury; the human result is always shown before it. */
export function ProofLink({ signature }: { signature: string }) {
  return (
    <a className="proof" href={explorerTx(signature)} target="_blank" rel="noreferrer">
      {copy.common.proof}
    </a>
  );
}
