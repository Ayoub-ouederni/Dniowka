import { copy } from "../copy";
import { flipDigits, formatCountdown } from "../format";

/**
 * Split-flap countdown for the big screen. Each digit card is keyed by its value, so a change
 * remounts it and plays the flip once (none with reduced motion). Units sit under each pair,
 * so it never reads as a time of day.
 */
export function FlipClock({ seconds }: { seconds: number }) {
  return (
    <div className="flip" role="timer" aria-label={formatCountdown(seconds)}>
      {flipDigits(seconds).map((g) => (
        <div key={g.unit} className="flip-group" aria-hidden="true">
          <div className="flip-digits">
            {g.digits.split("").map((d, i) => (
              <span key={`${i}-${d}`} className="flip-card">
                {d}
              </span>
            ))}
          </div>
          <span className="flip-unit">{copy.bigScreen.units[g.unit]}</span>
        </div>
      ))}
    </div>
  );
}
