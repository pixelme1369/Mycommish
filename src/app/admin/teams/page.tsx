import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAgents } from "@/app/admin/agents/queries";
import { listKnownSalesRepNames } from "@/lib/agents/sales-reps";
import { listTeamLeads } from "@/lib/teams/team-lead-bonus";
import { TeamLeadEditor } from "./team-lead-editor";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string }>;
}) {
  const session = await requireAdmin();
  void session;
  const { agentId } = await searchParams;

  const [agents, salesReps, teams] = await Promise.all([
    listAgents(),
    listKnownSalesRepNames(),
    listTeamLeads(),
  ]);

  if (!agentId) {
    return (
      <AppShell wide>
        <PageHeader
          eyebrow={
            <Link
              href="/admin/agents"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
            >
              ← Users
            </Link>
          }
          title="Team leads"
          description="Open a user on Users, then choose Team lead to set their bonus."
          actions={<SignOutButton />}
        />
        {teams.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No team leads configured yet.</p>
        ) : (
          <Card className="glass-panel mt-8 overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.leadDisplayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.bonusScope === "all_period_units"
                        ? "All period units"
                        : `${t.members.length} members`}
                    </p>
                  </div>
                  <Link
                    href={`/admin/teams?agentId=${t.leadAgentId}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </AppShell>
    );
  }

  const agent = agents.find((a) => a.id === agentId);
  if (!agent) notFound();

  const existing = teams.find((t) => t.leadAgentId === agentId) ?? null;
  const agentOptions = [
    {
      id: agent.id,
      displayName: agent.displayName,
      aliases: agent.aliases.map((al) => al.agentName),
    },
  ];

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <Link
            href="/admin/agents"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            ← Users
          </Link>
        }
        title={`Team lead · ${agent.displayName}`}
        description={
          existing
            ? "Edit rate, unit scope, and members — open periods update on save."
            : "Make this user a team lead — bonus lands on their net after CRM upload."
        }
        actions={<SignOutButton />}
      />

      <Card className="glass-panel mt-8 p-4">
        {agent.aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a CRM alias on this user’s details first, then come back to set team lead pay.
          </p>
        ) : (
          <TeamLeadEditor
            key={existing?.id ?? `new-${agent.id}`}
            agents={agentOptions}
            salesReps={salesReps}
            existing={existing}
            lockLeadAgent
          />
        )}
      </Card>
    </AppShell>
  );
}
