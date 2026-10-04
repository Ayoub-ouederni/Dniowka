import type { ReactNode } from "react";

export type ReceiptLine = {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  /** Money arriving (mint underline). */
  plus?: boolean;
};

/** Paper slip: torn zigzag bottom, dotted leaders, monospace figures. */
export function Receipt({
  title,
  lines,
  children,
  className = "",
}: {
  title?: ReactNode;
  lines: (ReceiptLine | false | null)[];
  children?: ReactNode;
  className?: string;
}) {
  return (
    // The wrapper carries the shadow: a mask (the zigzag edge) would clip it.
    <div className={`receipt-wrap ${className}`}>
      <section className="receipt">
        {title && <h3 className="receipt-title">{title}</h3>}
        <dl className="leaders">
          {lines.map(
            (l, i) =>
              l && (
                <div
                  key={i}
                  className={[l.strong && "strong", l.plus && "plus"].filter(Boolean).join(" ")}
                >
                  <dt>{l.label}</dt>
                  <dd>{l.value}</dd>
                </div>
              ),
          )}
        </dl>
        {children}
      </section>
    </div>
  );
}
