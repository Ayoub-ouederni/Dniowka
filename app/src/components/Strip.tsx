import type { CSSProperties } from "react";

import { COUPONS, couponsFilled } from "../format";
import { copy } from "../copy";

/**
 * Plain 30-day strip. Fill comes from the program's `earned` figure, never from the clock.
 * Coupon design, tearing and animations are M4.
 */
export function Strip({
  earned,
  withdrawn,
  net,
}: {
  earned: bigint;
  withdrawn: bigint;
  net: bigint;
}) {
  const filled = couponsFilled(earned, net);
  const taken = couponsFilled(withdrawn, net);
  return (
    <figure className="strip-wrap">
      <ol className="strip" aria-label={copy.salary.stripLegend}>
        {Array.from({ length: COUPONS }, (_, i) => {
          const fill = Math.min(1, Math.max(0, filled - i));
          const isTaken = taken - i >= 1;
          return (
            <li
              key={i}
              className={isTaken ? "coupon taken" : "coupon"}
              style={{ "--fill": `${Math.round(fill * 100)}%` } as CSSProperties}
            >
              {i + 1}
            </li>
          );
        })}
      </ol>
      <figcaption>{copy.salary.stripLegend}</figcaption>
    </figure>
  );
}
