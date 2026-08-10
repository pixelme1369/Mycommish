import Link from "next/link";
import { CrmUploadForm } from "./crm-upload-form";
import { CordobaUploadForm } from "./cordoba-upload-form";
import { HistoryUploadForm } from "./history-upload-form";
import { DeletePeriodButton } from "./delete-period-button";
import { DeleteHistoryPeriodButton } from "./delete-history-period-button";
import {
  DeleteAllPeriodsButton,
  DeleteUploadByFilenameButton,
} from "./delete-bulk-periods-button";
import { ClosePeriodButton } from "./close-period-button";
import {
  listCalculatedPeriods,
  listHistoryPeriods,
  listRecentUploads,
} from "./actions";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader, SectionTitle } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PeriodRow = Awaited<ReturnType<typeof listCalculatedPeriods>>[number];

function groupByFilename(periods: PeriodRow[]) {
  const map = new Map<string, PeriodRow[]>();
  for (const p of periods) {
    const key = p.filename?.trim() || "(no filename)";
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return [...map.entries()];
}

export default async function AdminHome() {
  const session = await requireAdmin();
  const [periods, historyPeriods, uploads] = await Promise.all([
    listCalculatedPeriods().catch(() => []),
    listHistoryPeriods().catch(() => []),
    listRecentUploads().catch(() => []),
  ]);

  const calculatedGroups = groupByFilename(periods);
  const historyGroups = groupByFilename(historyPeriods);

  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· admin · {session.user.displayName}</span>
          </span>
        }
        title="Admin"
        description="Upload History → CRM → Cordoba. Manage calculated payouts and audit history."
        actions={
          <>
            <Link
              href="/admin/agents"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manage agents
            </Link>
            <Link
              href="/portal"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Portal
            </Link>
            <SignOutButton />
          </>
        }
      />

      <Card className="glass-panel mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">Upload order</CardTitle>
          <CardDescription>Follow this sequence so chargebacks land correctly.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">History</span> (if you have a prior
              ledger) — blocks double-pay and stores Rate for later clawbacks
            </li>
            <li>
              <span className="font-medium text-foreground">CRM</span> — calculated commissions +
              our dropped dates
            </li>
            <li>
              <span className="font-medium text-foreground">Cordoba</span> last — needs CRM
              clears/drops to place chargebacks
            </li>
          </ol>
        </CardContent>
      </Card>

      <section className="mt-10">
        <SectionTitle>1. Commission history</SectionTitle>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <HistoryUploadForm />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle hint="Months that already exist skip new units — delete them below first if you need a clean re-import.">
          2. CRM upload
        </SectionTitle>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <CrmUploadForm />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>3. Cordoba payout</SectionTitle>
        <Card className="glass-panel">
          <CardContent className="pt-6">
            <CordobaUploadForm />
          </CardContent>
        </Card>
      </section>

      <Separator className="my-12" />

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <SectionTitle>Calculated periods</SectionTitle>
          {periods.length > 0 ? (
            <DeleteAllPeriodsButton kind="calculated" count={periods.length} />
          ) : null}
        </div>
        {periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — upload a CRM export.</p>
        ) : (
          <div className="space-y-4">
            {calculatedGroups.map(([filename, group]) => (
              <Card key={`crm-${filename}`} className="glass-panel overflow-hidden py-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-4 py-2.5 text-sm">
                  <span className="font-medium">{filename}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      {group.length} period{group.length === 1 ? "" : "s"}
                    </span>
                    {filename !== "(no filename)" ? (
                      <DeleteUploadByFilenameButton
                        filename={filename}
                        kind="calculated"
                        periodCount={group.length}
                      />
                    ) : null}
                  </div>
                </div>
                <ul className="divide-y divide-border/70">
                  {group.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/periods/${p.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.periodLabel}
                        </Link>
                        <Badge variant="secondary">{p.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Link
                          href={`/admin/periods/${p.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          {p._count.agentPeriods} agent
                          {p._count.agentPeriods === 1 ? "" : "s"}
                        </Link>
                        {p.status === "open" ? (
                          <ClosePeriodButton periodId={p.id} periodLabel={p.periodLabel} />
                        ) : null}
                        <DeletePeriodButton periodId={p.id} periodLabel={p.periodLabel} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <SectionTitle hint="Not shown to agents as owed. Used to block double-pay and supply Rate for clawbacks.">
            History periods
          </SectionTitle>
          {historyPeriods.length > 0 ? (
            <DeleteAllPeriodsButton kind="history" count={historyPeriods.length} />
          ) : null}
        </div>
        {historyPeriods.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — upload a history ledger.</p>
        ) : (
          <div className="space-y-4">
            {historyGroups.map(([filename, group]) => (
              <Card key={`hist-${filename}`} className="glass-panel overflow-hidden py-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-4 py-2.5 text-sm">
                  <span className="font-medium">{filename}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>
                      {group.length} period{group.length === 1 ? "" : "s"}
                    </span>
                    {filename !== "(no filename)" ? (
                      <DeleteUploadByFilenameButton
                        filename={filename}
                        kind="history"
                        periodCount={group.length}
                      />
                    ) : null}
                  </div>
                </div>
                <ul className="divide-y divide-border/70">
                  {group.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/history/${p.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {p.periodLabel}
                        </Link>
                        <Badge variant="outline">history</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Link
                          href={`/admin/history/${p.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          {p._count.agentPeriods} agent
                          {p._count.agentPeriods === 1 ? "" : "s"}
                        </Link>
                        <DeleteHistoryPeriodButton
                          periodId={p.id}
                          periodLabel={p.periodLabel}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionTitle>Recent uploads</SectionTitle>
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upload batches yet.</p>
        ) : (
          <Card className="glass-panel overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {uploads.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{u.type}</Badge>
                    <span className="text-foreground">{u.filename}</span>
                  </div>
                  <Link
                    href={`/admin/uploads/${u.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    {u.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC →
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
