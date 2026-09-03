import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { adminHomeLinkLabel, formatRoleLabel } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listOpenerFileClaimsForAdmin } from "@/lib/opener/file-claims";
import { OpenerClaimReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

export default async function AdminOpenerClaimsPage() {
  const session = await requireSuperAdmin();
  const claims = await listOpenerFileClaimsForAdmin();
  const pendingCount = claims.filter((c) => c.status === "pending").length;

  return (
    <AppShell wide className="max-w-[100rem]">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· {formatRoleLabel(session.user.role)}</span>
          </span>
        }
        title="File claims · Openers"
        description={`${pendingCount} pending · Accept assigns the Forth transfer to the opener · Reject closes the request`}
        actions={
          <>
            <Link
              href="/admin/claims"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Agent
            </Link>
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {adminHomeLinkLabel(session.user.role)}
            </Link>
            <SignOutButton />
          </>
        }
      />

      <Card className="glass-panel mt-6 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Requested</th>
                <th className="px-3 py-2 font-medium">Opener</th>
                <th className="px-3 py-2 font-medium">File ID</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">CRM snapshot</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Review</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    No opener claims yet.
                  </td>
                </tr>
              ) : (
                claims.map((c) => (
                  <tr key={c.id} className="border-t border-border/60 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {c.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.agent.displayName}</div>
                      <div className="text-xs text-muted-foreground">{c.agent.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{c.forthId}</td>
                    <td className="px-3 py-2">{c.clientName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.enrolledSnapshot === false
                        ? "Not Enrolled"
                        : c.enrolledSnapshot
                          ? "Enrolled"
                          : "—"}
                      <br />
                      {c.transferAgentSnapshot
                        ? `Transfer Agent: ${c.transferAgentSnapshot}`
                        : "No Transfer Agent"}
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 text-xs text-muted-foreground">
                      {c.note || "—"}
                      {c.adminNote ? (
                        <>
                          <br />
                          Admin: {c.adminNote}
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={c.status === "pending" ? "secondary" : "outline"}
                        className="font-normal capitalize"
                      >
                        {c.status}
                      </Badge>
                      {c.reviewedBy ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          by {c.reviewedBy.displayName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <OpenerClaimReviewForm
                        claimId={c.id}
                        pending={c.status === "pending"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
