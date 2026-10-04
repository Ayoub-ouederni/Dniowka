import { copy } from "../copy";
import { chooseLang, useLang } from "../lang";

/** EN | PL, each a ≥ 44 px button; the active one is pressed. */
export function LangToggle() {
  const lang = useLang();
  return (
    <div className="lang" role="group" aria-label={copy.lang.label}>
      {(["en", "pl"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => chooseLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
