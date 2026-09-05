/** Pure display formatters — safe for Client Components (no DB). */

export function money(n: number | string | { toString(): string }) {
  const v = typeof n === "number" ? n : Number(n);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** tierRate stored as fraction (0.01). */
export function ratePercent(fraction: number | string | { toString(): string }) {
  const v = typeof fraction === "number" ? fraction : Number(fraction);
  return `${(v * 100).toFixed(2)}%`;
}

/** cancellationRate stored as percent (12.5). */
export function cancelRatePercent(pctValue: number | string | { toString(): string }) {
  const v = typeof pctValue === "number" ? pctValue : Number(pctValue);
  return `${v.toFixed(1)}%`;
}

const PACIFIC = "America/Los_Angeles";

/** `2026-09-05 3:35 PM PDT` in America/Los_Angeles. */
export function formatPacificDateAndTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
  return `${day} ${time}`;
}
