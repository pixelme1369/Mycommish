import Link from "next/link";
import { requireSession } from "@/lib/auth-guards";
import { adminNavLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAgentFiles } from "@/lib/portal/files";
import { listMyFileClaims } from "./actions";
import { MissingFileClaimForm } from "./claim-form";
import { AgentFilesTable, FileLookupChat } from "./files-client";
import { lookupFileChatAction } from "./lookup-action";

export const dynamic = "force-dynamic";

export default async function PortalFilesPage() {
  const session = await requireSession();
  const aliasNames = session.user.aliasNames || [];
  const agentId = session.user.agentId;

  const [files, claims] = await Promise.all([
    listAgentFiles(aliasNames),
    agentId ? listMyFileClaims(agentId) : Promise.resolve([]),
  ]);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· portal</span>
          </span>
        }
        title="My files"
        description="CRM files on your latest calculated periods · ask about status · flag missing ones"
        actions={
          <>
            <Link
              href="/portal"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Commissions
            </Link>
            {session.user.isAdmin ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : session.user.role === "manager" ? (
              <Link
                href="/manager"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Manager
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <section className="mt-8">
        <h2 className="font-heading text-lg tracking-tight">Ask about a file</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter External ID (ADP CRM) or client name — same ID Cordoba uses; answers use CRM data for your aliases.
        </p>
        <Card className="glass-panel mt-3 p-4">
          <FileLookupChat lookupAction={lookupFileChatAction} />
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-lg tracking-tight">Files on my book</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"} in the latest 2 calculated periods
        </p>
        <div className="mt-3">
          {!aliasNames.length ? (
            <Card className="glass-panel p-4 text-sm text-muted-foreground">
              No CRM aliases on your login yet.
            </Card>
          ) : files.length === 0 ? (
            <Card className="glass-panel p-4 text-sm text-muted-foreground">
              No client files in the latest calculated periods for {aliasNames.join(", ")}.
            </Card>
          ) : (
            <AgentFilesTable files={files} />
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-lg tracking-tight">Missing file?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit External ID + Name for admin review. Accepted claims do not invent commission —
          admin fixes via the next CRM upload.
        </p>
        <Card className="glass-panel mt-3 p-4">
          <MissingFileClaimForm />
        </Card>
      </section>

      {claims.length > 0 ? (
        <section className="mt-10 mb-4">
          <h2 className="font-heading text-lg tracking-tight">My claims</h2>
          <Card className="glass-panel mt-3 overflow-hidden py-0">
            <ul className="divide-y divide-border/70">
              {claims.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                        <span className="font-mono text-xs">
                        {c.crmId}
                      </span>
                      {" · "}
                      {c.clientName}
                    </p>
                    {c.note ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
                    ) : null}
                    {c.adminNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">Admin: {c.adminNote}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant={c.status === "pending" ? "secondary" : "outline"}
                    className="font-normal capitalize"
                  >
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
