/** EN/PL choice: kept on this device, applied to `copy` and `<html lang>`. */
import { useSyncExternalStore } from "react";

import { type Lang, getLang, setLang } from "./copy";

const KEY = "dniowka:lang";
const listeners = new Set<() => void>();

function apply(next: Lang) {
  setLang(next);
  document.documentElement.lang = next;
}

/** Called once before the first render. */
export function initLang() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // private mode: English by default
  }
  apply(saved === "pl" ? "pl" : "en");
}

export function chooseLang(next: Lang) {
  apply(next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // the choice just won't survive a reload
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders the caller when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
