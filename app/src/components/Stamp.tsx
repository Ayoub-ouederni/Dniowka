export type StampKind = "refused" | "paid" | "confirming";

/** Rubber stamp (plain for now; the real stamp design comes with M4). */
export function Stamp({ kind, children }: { kind: StampKind; children: string }) {
  return (
    <div className={`stamp stamp-${kind}`} role="status">
      {children}
    </div>
  );
}
