import Link from "next/link";
import { requireManagerOrAdmin, isAdminUser } from "@/lib/auth-guards";
import { adminHomeLinkLabel, formatRoleLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import {
  listAdvanceAgentChoices,
  listAdvances,
  listCalculatedPeriodLabels,
  payDateLabel,
} from "@/lib/advances";
import { CreateAdvanceForm } from "./create-advance-form";
import { CancelAdvanceButton } from "./cancel-advance-button";

export const dynamic = "force-dynamic";

export default async function ManagerAdvancesPage() {
  const session = await requireManagerOrAdmin();
  const admin = isAdminUser(session);
  const [agents, periodLabels, advances] = await Promise.all([
    listAdvanceAgentChoices(),
    listCalculatedPeriodLabels(),
    listAdvances({ includeCancelled: true }),
  ]);

  const active = advances.filter((a) => !a.cancelledAt);
  const cancelled = advances.filter((a) => a.cancelledAt);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {formatRoleLabel(session.user.role)}</span>
          </span>
        }
        title="Advances"
        description="Managers, admins, and super admins · company cash early · survives CRM delete/re-upload"
        actions={
          <>
            <Link
              href={admin ? "/admin" : "/manager"}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {admin ? adminHomeLinkLabel(session.user.role) : "← Manager"}
            </Link>
            <SignOutButton />
          </>
        }
      />

      <section className="mt-8">
        <h2 className="font-heading text-lg tracking-tight">Give an advance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved in the database (not on the upload file). Delete/re-upload CRM and the advance
          comes back onto net automatically. Example: pay with July (Aug 25 check), deduct from
          August.
        </p>
        <Card className="glass-panel mt-3 p-4">
          {periodLabels.length < 1 ? (
            <p className="text-sm text-muted-foreground">
              Need a calculated period to pay with. Upload CRM first.
            </p>
          ) : (
            <CreateAdvanceForm agents={agents} periodLabels={periodLabels} />
          )}
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-lg tracking-tight">Active advances</h2>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <Card className="glass-panel mt-3 overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {active.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {a.agentName}
                      <span className="mx-2 text-border">·</span>
                      <span className="tabular-nums text-money">{money(a.amount)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      + on {a.payWithPeriodLabel}
                      {a.payApplied ? "" : " (queued)"}
                      {" · − on "}
                      {a.deductFromPeriodLabel}
                      {a.repayApplied ? "" : " (queued)"}
                      {" · by "}
                      {a.createdByName}
                    </p>
                    {a.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!a.payApplied || !a.repayApplied ? (
                      <Badge variant="secondary" className="font-normal">
                        Partial
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Applied
                      </Badge>
                    )}
                    <CancelAdvanceButton advanceId={a.id} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {cancelled.length > 0 ? (
        <section className="mt-10 mb-4">
          <h2 className="font-heading text-lg tracking-tight">Cancelled</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {cancelled.slice(0, 20).map((a) => (
              <li key={a.id}>
                {a.agentName} · {money(a.amount)} · {a.payWithPeriodLabel} →{" "}
                {a.deductFromPeriodLabel}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
