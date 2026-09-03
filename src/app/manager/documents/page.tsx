import Link from "next/link";
import { requireManagerOrAdmin, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, formatRoleLabel } from "@/lib/roles";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  countSignableAgents,
  listAdminUploadedDocuments,
  listDocumentAgents,
} from "@/lib/portal/signed-documents";
import { sendAgentDocumentAction } from "@/app/admin/document-actions";
import { AdminDocumentSend } from "@/app/admin/admin-document-send";
import { ManagerTopNav } from "@/app/manager/manager-top-nav";
import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ManagerUploadedDocumentsPage() {
  const session = await requireManagerOrAdmin();
  const role = sessionRole(session);
  const agentId = session.user.agentId;
  const [rows, recipientCount, agents, pendingClaims] = await Promise.all([
    listAdminUploadedDocuments(),
    countSignableAgents(),
    listDocumentAgents(),
    prisma.fileClaim
      .count({ where: { status: FileClaimStatus.pending } })
      .catch(() => 0),
  ]);

  return (
    <AppShell wide>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {formatRoleLabel(session.user.role)}</span>
          </span>
        }
        title="Uploaded documents"
        description="Company PDFs sent to agents for e-sign in the portal"
        actions={
          <>
            <ManagerTopNav
              active="documents"
              pendingClaims={pendingClaims}
              showAgentPortal={Boolean(agentId)}
            />
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {adminNavLabel(session.user.role)}
              </Link>
            ) : null}
          </>
        }
      />

      {rows.length === 0 ? (
        <Card className="glass-panel mt-4 p-6 text-sm text-muted-foreground">
          No uploads yet. Send a PDF below for agents to sign.
        </Card>
      ) : (
        <Card className="glass-panel mt-4 overflow-hidden py-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">For</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Sent</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((d) => {
                const signedCount = d.recipients.filter(
                  (r) => r.status === "signed",
                ).length;
                const one =
                  d.recipients.length === 1 ? d.recipients[0] : null;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.filename}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {one
                        ? one.displayName
                        : `${d.recipients.length} agent${d.recipients.length === 1 ? "" : "s"}`}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary">
                        {d.filedRecord
                          ? "On file"
                          : `${signedCount}/${d.recipients.length} signed`}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatWhen(d.sentAt)}
                      {d.createdByName ? ` · ${d.createdByName}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a
                        href={`/api/admin/documents/${d.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-8",
                        )}
                      >
                        View
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-10 max-w-2xl">
        <AdminDocumentSend
          sendAction={sendAgentDocumentAction}
          recipientCount={recipientCount}
          agents={agents}
          allowFileSignedCopy={false}
        />
      </div>
    </AppShell>
  );
}
