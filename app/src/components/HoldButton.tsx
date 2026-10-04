import { type CSSProperties, useEffect, useRef, useState } from "react";

const HOLD_MS = 1_200;

/**
 * Press and hold to confirm (pointer, or Space/Enter held down). The bar is progress
 * feedback, so it stays with reduced motion. A click with no press at all (screen readers'
 * virtual click) confirms straight away: the receipt before it was the review step.
 */
export function HoldButton({
  label,
  holdingLabel,
  hint,
  disabled,
  onConfirm,
}: {
  label: string;
  holdingLabel: string;
  hint: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const started = useRef<number | null>(null);
  const frame = useRef(0);
  const pressed = useRef(false);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Event and frame timestamps share one clock, so no clock is read during render.
  const tick = (t: number) => {
    if (started.current === null) return;
    const p = Math.min(1, (t - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      started.current = null;
      confirmRef.current();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };
  const start = (at: number) => {
    if (disabled || started.current !== null) return;
    pressed.current = true;
    started.current = at;
    frame.current = requestAnimationFrame(tick);
  };
  const stop = () => {
    started.current = null;
    cancelAnimationFrame(frame.current);
    setProgress(0);
  };

  return (
    <>
      <button
        type="button"
        className="primary hold"
        disabled={disabled}
        style={{ "--hold": progress } as CSSProperties}
        aria-describedby="hold-hint"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start(e.timeStamp);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          if (!e.repeat) start(e.timeStamp);
        }}
        onKeyUp={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          stop();
        }}
        onClick={(e) => {
          if (e.detail === 0 && !pressed.current && !disabled) confirmRef.current();
          pressed.current = false;
        }}
      >
        <span>{progress > 0 && progress < 1 ? holdingLabel : label}</span>
      </button>
      <p id="hold-hint" className="small hold-hint">
        {hint}
      </p>
    </>
  );
}
