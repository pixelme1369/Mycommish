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
