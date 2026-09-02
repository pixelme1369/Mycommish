import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
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
import { DocumentsSectionNav } from "@/app/admin/documents-section-nav";

export const dynamic = "force-dynamic";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AdminUploadedDocumentsPage() {
  const session = await requireAdmin();
  const [rows, recipientCount, agents] = await Promise.all([
    listAdminUploadedDocuments(),
    countSignableAgents(),
    listDocumentAgents(),
  ]);

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
        title="Uploaded documents"
        description="Company PDFs on agent portal records — e-sign requests and filed paper copies"
        actions={<SignOutButton />}
      />

      <DocumentsSectionNav active="uploaded" />

      {rows.length === 0 ? (
        <Card className="glass-panel mt-4 p-6 text-sm text-muted-foreground">
          No uploads yet. Use Send or file below.
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
                const signedCount = d.recipients.filter((r) => r.status === "signed")
                  .length;
                const one = d.recipients.length === 1 ? d.recipients[0] : null;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.filename}</p>
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
        />
      </div>
    </AppShell>
  );
}
