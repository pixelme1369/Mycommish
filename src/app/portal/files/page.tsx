import { redirect } from "next/navigation";
import { isSuperAdminUser, requireSession } from "@/lib/auth-guards";
import { adminNavLabel, isOpenerRole } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { PortalTopBar } from "@/components/portal-top-bar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listAgentFiles } from "@/lib/portal/files";
import { listOpenerLogsForAgent } from "@/lib/opener/logs";
import { listMyOpenerFileClaims } from "@/lib/opener/file-claims";
import { listMyFileClaims } from "./actions";
import { MissingFileClaimForm, OpenerMissingFileClaimForm } from "./claim-form";
import { AgentFilesTable, FileLookupChat } from "./files-client";
import { lookupFileChatAction } from "./lookup-action";
import {
  claimOpenerFileFromLookupAction,
  lookupOpenerFileChatAction,
} from "./opener-claim-actions";
import { OpenerFilesTable } from "./opener-files-table";

export const dynamic = "force-dynamic";

export default async function PortalFilesPage() {
  const session = await requireSession();
  if (isSuperAdminUser(session)) redirect("/admin");
  const aliasNames = session.user.aliasNames || [];
  const agentId = session.user.agentId;

  const opener = isOpenerRole(session.user.role);
  const [files, claims, openerLogs, openerClaims] = await Promise.all([
    opener ? Promise.resolve([]) : listAgentFiles(aliasNames),
    opener || !agentId ? Promise.resolve([]) : listMyFileClaims(agentId),
    opener && agentId ? listOpenerLogsForAgent(agentId) : Promise.resolve([]),
    opener && agentId ? listMyOpenerFileClaims(agentId) : Promise.resolve([]),
  ]);

  const staffHref = session.user.isAdmin
    ? "/admin"
    : session.user.role === "manager"
      ? "/manager"
      : undefined;
  const staffLabel = session.user.isAdmin
    ? `${adminNavLabel(session.user.role)} →`
    : session.user.role === "manager"
      ? "Manager →"
      : undefined;

  return (
    <AppShell wide>
      <PortalTopBar
        staffHref={staffHref}
        staffLabel={staffLabel}
        commissionsHref={
          session.user.role === "manager" || session.user.isAdmin
            ? "/portal?personal=1"
            : "/portal"
        }
        filesHref="/portal/files"
        opener={opener}
        openerManager={false}
      />

      <header className="mt-8">
        <h1 className="font-heading text-2xl tracking-tight text-foreground sm:text-[1.65rem]">
          My files
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {opener
            ? "Transfers from Forth · ask about a file · claim for super-admin review"
            : "CRM files on your latest calculated periods · ask about status · flag missing ones"}
        </p>
      </header>

      {opener ? (
        <>
          <section className="mt-8">
            <h2 className="font-heading text-lg tracking-tight">Ask about a file</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter File ID (Forth or Cordoba External ID). You’ll see Transfer Agent and whether
              it’s enrolled — you can still claim for super-admin review.
            </p>
            <Card className="glass-panel mt-3 p-4">
              <FileLookupChat
                lookupAction={lookupOpenerFileChatAction}
                claimAction={claimOpenerFileFromLookupAction}
                intro="Ask by File ID. I’ll tell you Transfer Agent and enrolled vs Not Enrolled. Use Claim to send it to super-admin."
                clearedLabel="Transferred"
              />
            </Card>
          </section>

          <section className="mt-10">
            <h2 className="font-heading text-lg tracking-tight">My transfers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {openerLogs.length} transfer{openerLogs.length === 1 ? "" : "s"}
            </p>
            <div className="mt-3">
              <OpenerFilesTable
                rows={openerLogs.map((r) => ({
                  id: r.id,
                  transferYmd: r.transferYmd,
                  forthId: r.forthId,
                  debtLoad: Number(r.debtLoad),
                  stageTitle: r.stageTitle,
                  status: r.status,
                  commission: Number(r.commission),
                  payStatus: r.payStatus,
                  unmatched: r.unmatched,
                  notes: r.notes,
                }))}
              />
            </div>
          </section>

          <section className="mt-10">
            <h2 className="font-heading text-lg tracking-tight">Missing file?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit File ID + name for super-admin review — even if Transfer Agent is someone else
              or the file is Not Enrolled.
            </p>
            <Card className="glass-panel mt-3 p-4">
              <OpenerMissingFileClaimForm />
            </Card>
          </section>

          {openerClaims.length > 0 ? (
            <section className="mb-4 mt-10">
              <h2 className="font-heading text-lg tracking-tight">My claims</h2>
              <Card className="glass-panel mt-3 overflow-hidden py-0">
                <ul className="divide-y divide-border/70">
                  {openerClaims.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          <span className="font-mono text-xs">{c.forthId}</span>
                          {" · "}
                          {c.clientName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.enrolledSnapshot === false
                            ? "Not Enrolled"
                            : c.enrolledSnapshot
                              ? "Enrolled"
                              : "Enrollment unknown"}
                          {c.transferAgentSnapshot
                            ? ` · Transfer Agent: ${c.transferAgentSnapshot}`
                            : " · No Transfer Agent"}
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
        </>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="font-heading text-lg tracking-tight">Ask about a file</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter External ID (ADP CRM) or client name — same ID Cordoba uses; answers use CRM data for
              your aliases.
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
            <section className="mb-4 mt-10">
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
        </>
      )}
    </AppShell>
  );
}
