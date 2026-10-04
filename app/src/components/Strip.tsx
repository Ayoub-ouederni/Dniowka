import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { copy } from "../copy";
import { couponsFilled, formatZl } from "../format";
import { type Coupon, takenWhole } from "../strip";

const TEAR_MS = 900;

/** `200,00` without the currency (the strip's header says "zł a day"). */
const short = (grosze: bigint) => formatZl(grosze).replace(/\u00a0zł$/, "");

/**
 * The month as a booklet of 30 perforated day-coupons. Fill = the program's `earned`; each
 * coupon's fill glides over one poll instead of jumping (CSS transition, none with reduced
 * motion). Taken days are torn off to a stub and counted in the pile at the bottom.
 */
export function Strip({
  coupons,
  withdrawn,
  net,
  selected = 0n,
  onPick,
  stamp,
  paid = false,
  fly = false,
}: {
  coupons: Coupon[];
  withdrawn: bigint;
  net: bigint;
  /** Amount being torn off (tear mode): those coupons are marked, with a tear line. */
  selected?: bigint;
  /** Tap/drag on a coupon in tear mode: its index. */
  onPick?: (index: number) => void;
  /** Rubber stamp laid over the strip (ODMOWA / WYPŁACONO). */
  stamp?: ReactNode;
  /** Payday has paid everything: every coupon is torn off. */
  paid?: boolean;
  /** Play the payday animation (coupons fly up into the total) once. */
  fly?: boolean;
}) {
  const whole = paid ? coupons.length : takenWhole(withdrawn, net);
  const shownWhole = useShownWhole(whole);
  const selFrom = couponsFilled(withdrawn, net);
  const selTo = selected > 0n ? couponsFilled(withdrawn + selected, net) : selFrom;
  const lastSelected = selected > 0n ? Math.ceil(selTo) - 1 : -1;
  const press = useRef<{ x: number; y: number; mouse: boolean } | null>(null);

  const pickAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-i]");
    // Days already torn off can't be picked again.
    if (el && onPick && !el.classList.contains("torn")) onPick(Number(el.dataset.i));
  };

  return (
    <figure className={`strip-wrap${paid ? " is-paid" : ""}${onPick ? " picking" : ""}`}>
      <figcaption className="strip-head">
        <span>{copy.salary.stripTitle}</span>
        <span className="small">
          {short(coupons[0]?.value ?? 0n)} {copy.salary.perDay}
        </span>
      </figcaption>
      <ol
        className="strip"
        // Mouse: press and drag down the strip. Touch: a tap picks, a scroll never does.
        onPointerDown={(e) => {
          if (!onPick) return;
          press.current = { x: e.clientX, y: e.clientY, mouse: e.pointerType === "mouse" };
          if (press.current.mouse) pickAt(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (press.current?.mouse && e.buttons === 1) pickAt(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          if (p && !p.mouse && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 10) {
            pickAt(e.clientX, e.clientY);
          }
        }}
        onPointerCancel={() => (press.current = null)}
        onPointerLeave={() => (press.current = null)}
      >
        {coupons.map((c, i) => {
          const isTorn = i < whole;
          const justTorn = !paid && i >= shownWhole && i < whole;
          const isSelected = !isTorn && selected > 0n && selTo > i && selFrom < i + 1;
          const state = isTorn
            ? "taken"
            : c.off
              ? "off"
              : c.today
                ? "today"
                : c.fill >= 1
                  ? "earned"
                  : "future";
          const cls = [
            "coupon",
            `c-${state}`,
            isTorn && !justTorn && "torn",
            justTorn && "tearing",
            isSelected && "selected",
            fly && "fly",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={c.day}
              data-i={i}
              className={cls}
              style={{ "--i": i } as CSSProperties}
              aria-label={copy.salary.couponLabel(
                c.day,
                copy.salary.couponState[state],
                formatZl(c.value),
              )}
            >
              <span className="c-stub" aria-hidden="true">
                {c.day}
              </span>
              <span className="c-body" aria-hidden="true">
                <span className="c-fill" style={{ transform: `scaleX(${c.fill})` }} />
                {c.taken > 0 && c.taken < 1 && (
                  <span className="c-part" style={{ width: `${c.taken * 100}%` }} />
                )}
                <span className="c-value">{c.off ? copy.salary.offContract : short(c.value)}</span>
                {c.today && !isTorn && <span className="c-now">{copy.salary.today}</span>}
              </span>
              {i === lastSelected && (
                <span className="tear-line" aria-hidden="true">
                  <span>✂ {copy.salary.tearLine}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {whole > 0 && !paid && (
        <div className="pile">
          <span className="pile-stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>{copy.salary.pile}</strong>
            <br />
            {copy.salary.pileText(whole, formatZl(withdrawn))}
          </span>
        </div>
      )}
      {stamp && (
        <div className="strip-stamp">
          <div className="strip-stamp-inner">{stamp}</div>
        </div>
      )}
      <p className="small strip-legend">{copy.salary.stripLegend}</p>
    </figure>
  );
}

/**
 * How many days were torn off when last shown: lags `whole` by the tear animation, so the
 * days torn since play it once (derived during render, no flash of the final state).
 */
function useShownWhole(whole: number) {
  const [shown, setShown] = useState(whole);
  useEffect(() => {
    if (whole === shown) return;
    const t = setTimeout(() => setShown(whole), whole > shown ? TEAR_MS : 0);
    return () => clearTimeout(t);
  }, [whole, shown]);
  return shown;
}
