import {
  groupBonusesByManager,
  payDateLabel,
  type ManagerBonusRow,
} from "@/lib/manager-bonus-view";
import { ManagerReimbursementsTable } from "@/components/manager-reimbursements-table";

/** Server wrapper — groups data here so the client never imports bonus helpers. */
export function ManagerReimbursementsSection({
  periodLabel,
  rows,
  adminControls,
}: {
  periodLabel: string;
  rows: ManagerBonusRow[];
  adminControls: boolean;
}) {
  const groups = groupBonusesByManager(rows).map((g) => ({
    ...g,
    owed: g.owed.map(serializeRow),
    reimbursed: g.reimbursed.map(serializeRow),
  }));
  const owedGrand = groups.reduce((s, g) => s + g.owedTotal, 0);
  const payDate = payDateLabel(periodLabel);

  return (
    <ManagerReimbursementsTable
      periodLabel={periodLabel}
      payDate={payDate}
      owedGrand={owedGrand}
      groups={groups}
      adminControls={adminControls}
    />
  );
}

function serializeRow(r: ManagerBonusRow) {
  return {
    ...r,
    paidOn: r.paidOn.toISOString(),
    reimbursedAt: r.reimbursedAt ? r.reimbursedAt.toISOString() : null,
  };
}
