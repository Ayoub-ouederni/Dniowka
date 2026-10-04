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
