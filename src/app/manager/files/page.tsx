import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listAllWindowFiles } from "@/lib/portal/files";
import { listMyFileClaims } from "@/app/portal/files/actions";
import { MissingFileClaimForm } from "@/app/portal/files/claim-form";
import { AgentFilesTable, FileLookupChat } from "@/app/portal/files/files-client";
import { lookupManagerFileChatAction } from "./lookup-action";

export const dynamic = "force-dynamic";

export default async function ManagerFilesPage() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const agentId = session.user.agentId;

  const [files, claims] = await Promise.all([
    listAllWindowFiles(),
    agentId ? listMyFileClaims(agentId) : Promise.resolve([]),
  ]);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· manager</span>
          </span>
        }
        title="All files"
        description="CRM files across the team · latest calculated periods · claim when something looks wrong"
        actions={
          <>
            <Link
              href="/manager"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Commissions
            </Link>
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </>
        }
      />

      <section className="mt-8">
        <h2 className="font-heading text-lg tracking-tight">Look up a file</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          External ID or client name — shows who it’s assigned to. Claim to send it for admin review.
        </p>
        <Card className="glass-panel mt-3 p-4">
          <FileLookupChat lookupAction={lookupManagerFileChatAction} />
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-lg tracking-tight">Team files</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"} in the latest 2 calculated periods
        </p>
        <div className="mt-3">
          {files.length === 0 ? (
            <Card className="glass-panel p-4 text-sm text-muted-foreground">
              No client files in the latest calculated periods yet.
            </Card>
          ) : (
            <AgentFilesTable files={files} showAgent allowClaim />
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-lg tracking-tight">Flag a file</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit External ID + Name for admin review. Accepted claims do not invent commission —
          admin fixes via the next CRM upload or reassignment.
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
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      <span className="font-mono text-xs">{c.crmId}</span>
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
