import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import { listTeamLeads } from "@/lib/teams/team-lead-bonus";

export const dynamic = "force-dynamic";

export default async function SuperAdminTeamLeadsPage() {
  const session = await requireSuperAdmin();
  const teams = await listTeamLeads();

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <Link
            href="/admin"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            {adminHomeLinkLabel(session.user.role)}
          </Link>
        }
        title="Team leads"
        description="Who earns a per-unit lead bonus, at what rate, and which CRM reps (or all period units) count."
        actions={<SignOutButton />}
      />

      {teams.length === 0 ? (
        <Card className="glass-panel mt-8 p-6 text-sm text-muted-foreground">
          No team leads configured yet. Open a user on{" "}
          <Link href="/admin/agents" className="underline underline-offset-2">
            Users
          </Link>
          , then choose Team lead.
        </Card>
      ) : (
        <ul className="mt-8 space-y-4">
          {teams.map((t) => (
            <li key={t.id}>
              <Card className="glass-panel overflow-hidden py-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <div>
                    <p className="font-medium">{t.leadDisplayName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      CRM pay name: {t.leadAgentName} · {money(t.ratePerUnit)}/unit
                    </p>
                  </div>
                  <Link
                    href={`/admin/teams?agentId=${t.leadAgentId}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Edit
                  </Link>
                </div>
                <div className="px-4 py-3 text-sm">
                  {t.bonusScope === "all_period_units" ? (
                    <p className="text-muted-foreground">
                      Scope: <span className="font-medium text-foreground">All period units</span>{" "}
                      (same total as Units cleared on the period page; no member list)
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        Scope:{" "}
                        <span className="font-medium text-foreground">
                          Selected team ({t.members.length})
                        </span>
                      </p>
                      {t.members.length === 0 ? (
                        <p className="mt-2 text-muted-foreground">No members selected.</p>
                      ) : (
                        <ul className="mt-2 columns-1 gap-x-8 sm:columns-2 lg:columns-3">
                          {t.members.map((m) => (
                            <li key={m.id} className="break-inside-avoid py-0.5">
                              {m.memberAgentName}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
