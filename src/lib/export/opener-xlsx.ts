import { prisma } from "@/lib/db";
import { listOpenerPlanAgents } from "@/lib/agents/opener";
import {
  addOpenerLogToCounts,
  emptyOpenerLogCounts,
} from "@/lib/opener/summary";
import {
  openerCommissionForPayStatus,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import {
  writeOpenerWorkbook,
  type OpenerExportLogRow,
  type OpenerExportSummaryRow,
} from "@/lib/export/opener-xlsx-write";

export { writeOpenerWorkbook } from "@/lib/export/opener-xlsx-write";
export type { OpenerExportLogRow, OpenerExportSummaryRow } from "@/lib/export/opener-xlsx-write";

export async function buildOpenerPeriodWorkbook(monthLabel: string) {
  if (!/^\d{4}-\d{2}$/.test(monthLabel)) return null;

  const [openers, logs, upscores] = await Promise.all([
    listOpenerPlanAgents(),
    prisma.openerTransferLog.findMany({
      where: { transferYmd: { startsWith: monthLabel } },
      select: {
        agentId: true,
        transferYmd: true,
        forthId: true,
        debtLoad: true,
        stageTitle: true,
        status: true,
        commission: true,
        payStatus: true,
        notes: true,
        unmatched: true,
        agent: { select: { displayName: true } },
      },
      orderBy: [{ transferYmd: "asc" }, { forthId: "asc" }],
    }),
    prisma.openerPeriodUpscore.findMany({
      where: { monthLabel },
      select: { agentId: true, amount: true },
    }),
  ]);

  const upscoreByAgent = new Map(
    upscores.map((u) => [u.agentId, Number(u.amount)]),
  );
  const countsByAgent = new Map<string, ReturnType<typeof emptyOpenerLogCounts>>();
  const names = new Map<string, string>();
  for (const o of openers) {
    names.set(o.id, o.displayName);
    countsByAgent.set(o.id, emptyOpenerLogCounts());
  }

  const exportLogs: OpenerExportLogRow[] = logs.map((row) => {
    const counts = countsByAgent.get(row.agentId) ?? emptyOpenerLogCounts();
    const commission = openerCommissionForPayStatus(
      Number(row.debtLoad),
      row.payStatus as OpenerPayStatusName,
    );
    addOpenerLogToCounts(counts, {
      payStatus: row.payStatus,
      commission,
      unmatched: row.unmatched,
    });
    countsByAgent.set(row.agentId, counts);
    names.set(row.agentId, row.agent.displayName);
    return {
      transferYmd: row.transferYmd,
      openerName: row.agent.displayName,
      forthId: row.forthId,
      debtLoad: Number(row.debtLoad),
      stageTitle: row.stageTitle,
      status: row.status,
      commission,
      payStatus: row.payStatus,
      notes: row.notes || "",
      unmatched: row.unmatched,
    };
  });

  const summaries: OpenerExportSummaryRow[] = [...names.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([agentId, openerName]) => {
      const c = countsByAgent.get(agentId) ?? emptyOpenerLogCounts();
      return {
        openerName,
        approvedTransfers: c.approvedTransfers,
        commissionTotal: c.commissionTotal,
        upscore: upscoreByAgent.get(agentId) ?? 0,
        excludedCanceled: c.excludedCanceled,
        pendingCrmReview: c.pendingCrmReview,
      };
    });

  return writeOpenerWorkbook({ monthLabel, logs: exportLogs, summaries });
}
