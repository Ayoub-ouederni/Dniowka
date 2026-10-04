export type StampKind = "refused" | "paid" | "confirming";

/**
 * Rubber stamp: double ink border, worn ink texture, tilted −12°, slammed down on arrival
 * (no slam with reduced motion). The human sentence always goes next to it, not inside.
 */
export function Stamp({ kind, children }: { kind: StampKind; children: string }) {
  return (
    <div className={`stamp stamp-${kind}`}>
      <span>{children}</span>
    </div>
  );
}
