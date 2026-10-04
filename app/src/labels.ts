/** Off-chain labels on the employer's own device (names never go on-chain). */
const labelsKey = "dniowka:labels";

export function readLabels(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(labelsKey) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveLabel(stream: string, name: string) {
  try {
    localStorage.setItem(labelsKey, JSON.stringify({ ...readLabels(), [stream]: name }));
  } catch {
    // labels are a convenience only
  }
}

export const companyKey = (authority: string) => `dniowka:company:${authority}`;

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * `#/labels?a=<employer>&c=<company>&<salary>=<name>…` (printed by `pnpm run seed:demo`):
 * stores the off-chain names on this device. Returns where to go next.
 */
export function importLabels(params: URLSearchParams): string {
  const authority = params.get("a");
  const company = params.get("c");
  for (const [key, name] of params) {
    if (key !== "a" && key !== "c" && ADDRESS.test(key) && name) saveLabel(key, name);
  }
  if (authority && ADDRESS.test(authority)) {
    if (company) {
      try {
        localStorage.setItem(companyKey(authority), company);
      } catch {
        // labels are a convenience only
      }
    }
    return `#/screen/${authority}`;
  }
  return "#/";
}
