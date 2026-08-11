import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAgents } from "./queries";
import { ReinstateSalesRepButton } from "@/app/admin/dismiss-buttons";
import { listDismissals } from "@/lib/agents/dismissal";
import { listKnownSalesRepNames } from "@/lib/agents/sales-reps";
import { AddUserPanel } from "./add-user-panel";
import { AgentsUsersTable, type AgentRowView } from "./agents-table";

export const dynamic = "force-dynamic";

export default async function ManageAgentsPage() {
  const session = await requireAdmin();
  const [agents, dismissals, salesReps] = await Promise.all([
    listAgents(),
    listDismissals(),
    listKnownSalesRepNames(),
  ]);

  const rows: AgentRowView[] = agents.map((a) => ({
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    role: a.role,
    employmentType: a.employmentType,
    companyName: a.companyName,
    hasPassword: Boolean(a.passwordHash),
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    suspendedAt: a.suspendedAt?.toISOString() ?? null,
    suspendedByName: a.suspendedBy?.displayName ?? null,
    aliases: a.aliases.map((al) => ({ id: al.id, agentName: al.agentName })),
  }));

  return (
    <AppShell wide>
      <PageHeader
        compact
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· admin</span>
          </span>
        }
        title="Users"
        description="Portal logins · Google works for any user email on this list · password optional · suspend blocks sign-in"
        actions={
          <>
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              ← Admin
            </Link>
            <SignOutButton />
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <AddUserPanel salesReps={salesReps} />
      </div>

      <Card className="glass-panel mt-4 overflow-hidden p-4">
        <AgentsUsersTable
          agents={rows}
          salesReps={salesReps}
          currentAdminId={session.user.agentId || null}
        />
      </Card>

      {dismissals.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-heading text-base tracking-tight">Dismissed sales reps</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Hidden from period lists, portal, and Gusto. Ledger history is kept. Separate from
            login suspend.
          </p>
          <Card className="glass-panel mt-3 overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {dismissals.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{d.agentName}</p>
                    <p className="text-xs text-muted-foreground">
                      Dismissed {d.dismissedAt.toISOString().slice(0, 10)}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                  </div>
                  <ReinstateSalesRepButton agentName={d.agentName} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
