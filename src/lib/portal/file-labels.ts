import type { ClientEventKind } from "@/generated/prisma/client";

export function fileKindLabel(kind: ClientEventKind | string): string {
  switch (kind) {
    case "cleared":
    case "low_credit_cleared":
      return "Cleared";
    case "pending":
      return "Pending cancel";
    case "safe_cancel":
      return "Safe cancel";
    case "same_month_cancel":
      return "Same-month cancel";
    case "clawback":
    case "cordoba_clawback":
      return "Clawback";
    case "history_paid":
      return "History paid";
    case "history_subtract":
      return "History subtract";
    default:
      return String(kind);
  }
}
