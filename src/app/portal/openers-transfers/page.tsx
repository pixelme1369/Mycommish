import { requireOpenerManager } from "@/lib/auth-guards";
import { AppShell } from "@/components/app-shell";
import { PortalTopBar } from "@/components/portal-top-bar";
import { OpenerPeriodPicker } from "@/components/opener-period-picker";
import {
  defaultOpenerPeriodLabel,
  listAllOpenerTransferLogs,
  listOpenerPayPeriodLabels,
} from "@/lib/opener/logs";
import { OpenerFilesTable, type OpenerFileRow } from "@/app/portal/files/opener-files-table";

export const dynamic = "force-dynamic";

export default async function OpenerManagerTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireOpenerManager();
  const { month: monthRaw } = await searchParams;
  const [periods, monthLabel] = await Promise.all([
    listOpenerPayPeriodLabels(),
    defaultOpenerPeriodLabel(monthRaw),
  ]);
  const logs = await listAllOpenerTransferLogs(monthLabel);

  return (
    <AppShell wide>
      <PortalTopBar opener openerManager />

      <header className="mt-8">
        <h1 className="font-heading text-2xl tracking-tight text-foreground sm:text-[1.65rem]">
          Openers Transfers
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every transfer logged by openers for this pay period
        </p>
      </header>

      <section className="mt-8">
        <OpenerPeriodPicker
          periods={periods}
          selected={monthLabel}
          pathname="/portal/openers-transfers"
          stats={
            logs.length > 0 ? (
              <p className="pb-0.5 text-sm tabular-nums text-muted-foreground">
                {logs.length} transfer{logs.length === 1 ? "" : "s"}
              </p>
            ) : null
          }
        />
        <div className="mt-3">
          <OpenerFilesTable
            rows={logs.map((r) => ({
              id: r.id,
              openerName: r.agent.displayName,
              transferYmd: r.transferYmd,
              forthId: r.forthId,
              debtLoad: Number(r.debtLoad),
              stageTitle: r.stageTitle,
              status: r.status,
              commission: Number(r.commission),
              payStatus: r.payStatus as OpenerFileRow["payStatus"],
              unmatched: r.unmatched,
              notes: r.notes,
            }))}
          />
        </div>
      </section>
    </AppShell>
  );
}
