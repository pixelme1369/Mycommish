import { paymentDateForPeriod } from "@/lib/commission/calculator";

/** Browser-safe types/helpers — do not import Prisma/db here. */

export type ManagerBonusStatusValue = "owed" | "reimbursed";
export type ManagerBonusRoleValue =
  | "super_admin"
  | "admin"
  | "manager"
  | "agent"
  | "opener"
  | "opener_manager";

export type ManagerBonusRow = {
  id: string;
  amount: number;
  reason: string;
  paidOn: Date;
  periodLabel: string;
  status: ManagerBonusStatusValue;
  reimbursedAt: Date | null;
  paidBy: { id: string; displayName: string; role: ManagerBonusRoleValue };
  recipientName: string;
  recipientAgentId: string | null;
};

export type ManagerBonusGroup = {
  paidById: string;
  paidByName: string;
  paidByRole: ManagerBonusRoleValue;
  owed: ManagerBonusRow[];
  reimbursed: ManagerBonusRow[];
  owedTotal: number;
  reimbursedTotal: number;
};

export function groupBonusesByManager(rows: ManagerBonusRow[]): ManagerBonusGroup[] {
  const by = new Map<string, ManagerBonusGroup>();
  for (const r of rows) {
    let g = by.get(r.paidBy.id);
    if (!g) {
      g = {
        paidById: r.paidBy.id,
        paidByName: r.paidBy.displayName,
        paidByRole: r.paidBy.role,
        owed: [],
        reimbursed: [],
        owedTotal: 0,
        reimbursedTotal: 0,
      };
      by.set(r.paidBy.id, g);
    }
    if (r.status === "owed") {
      g.owed.push(r);
      g.owedTotal += r.amount;
    } else {
      g.reimbursed.push(r);
      g.reimbursedTotal += r.amount;
    }
  }
  return [...by.values()].sort((a, b) => a.paidByName.localeCompare(b.paidByName));
}

export function payDateLabel(periodLabel: string): string {
  const d = paymentDateForPeriod(periodLabel);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
