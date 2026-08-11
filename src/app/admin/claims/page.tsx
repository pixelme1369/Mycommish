import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { listFileClaimsForAdmin } from "@/app/portal/files/actions";
import { ClearAllClaimsButton } from "./clear-all-claims-button";
import { ClaimReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

function DateLines({
  enrolled,
  cleared,
  dropped,
}: {
  enrolled: string;
  cleared: string;
  dropped: string;
}) {
  return (
    <div className="space-y-0.5 text-[11px] leading-snug text-muted-foreground">
      <div>
        <span className="text-foreground/50">Enr </span>
        {enrolled}
      </div>
      <div>
        <span className="text-foreground/50">Clr </span>
        {cleared}
      </div>
      <div>
        <span className="text-foreground/50">Drp </span>
        {dropped}
      </div>
    </div>
  );
}

export default async function AdminClaimsPage() {
  await requireAdmin();
  const [claims, totalClaimCount] = await Promise.all([
    listFileClaimsForAdmin(),
    prisma.fileClaim.count(),
  ]);
  const pendingCount = claims.filter((c) => c.status === "pending").length;

  const claimExternalIds = [...new Set(claims.map((c) => c.crmId))];
  const identities =
    claimExternalIds.length > 0
      ? await prisma.clientIdentity.findMany({
          where: {
            OR: [
              { externalId: { in: claimExternalIds } },
              { crmId: { in: claimExternalIds } },
            ],
          },
          select: {
            crmId: true,
            externalId: true,
            salesRep: true,
            clientName: true,
            crmStatus: true,
            enrolledDate: true,
            firstPaymentClearedDate: true,
            droppedDate: true,
          },
        })
      : [];
  const identityByClaimId = new Map<string, (typeof identities)[number]>();
  for (const id of identities) {
    if (id.externalId) identityByClaimId.set(id.externalId, id);
    identityByClaimId.set(id.crmId, id);
  }

  const crmIds = [...new Set(identities.map((i) => i.crmId))];
  const latestEvents =
    crmIds.length > 0
      ? await prisma.clientEvent.findMany({
          where: { crmId: { in: crmIds } },
          select: {
            crmId: true,
            kind: true,
            agentName: true,
            enrolledDate: true,
            firstPaymentClearedDate: true,
            droppedDate: true,
          },
          orderBy: [{ period: { periodLabel: "desc" } }],
        })
      : [];
  const eventByCrm = new Map<string, (typeof latestEvents)[number]>();
  for (const e of latestEvents) {
    if (!eventByCrm.has(e.crmId)) eventByCrm.set(e.crmId, e);
  }

  return (
    <AppShell wide className="max-w-[100rem]">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <BrandMark size="sm" />
            <span>· admin</span>
          </span>
        }
        title="File claims"
        description={`${pendingCount} pending · External ID (= Cordoba ID) · Accept moves open-period commission to claimer; closed periods stay locked`}
        actions={
          <>
            <ClearAllClaimsButton claimCount={totalClaimCount} />
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

      {claims.length === 0 ? (
        <Card className="glass-panel mt-8 p-4 text-sm text-muted-foreground">
          No claims yet.
        </Card>
      ) : (
        <Card className="glass-panel mt-8 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>External ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Claimed by</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead className="w-[12rem]">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((c) => {
                const identity = identityByClaimId.get(c.crmId);
                const event = identity ? eventByCrm.get(identity.crmId) : undefined;
                const status =
                  identity?.crmStatus ||
                  (event ? String(event.kind) : null) ||
                  (identity ? "In CRM" : "—");
                const enrolled =
                  event?.enrolledDate || identity?.enrolledDate || "—";
                const cleared =
                  event?.firstPaymentClearedDate ||
                  identity?.firstPaymentClearedDate ||
                  "—";
                const dropped =
                  event?.droppedDate || identity?.droppedDate || "—";
                const name = identity?.clientName || c.clientName;
                const assignedTo = identity?.salesRep || event?.agentName || "—";

                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      {c.crmId}
                    </TableCell>
                    <TableCell className="max-w-[9rem] whitespace-normal font-medium">
                      <div className="leading-snug">{name}</div>
                      {c.note ? (
                        <div className="mt-0.5 text-[11px] font-normal leading-snug text-muted-foreground">
                          “{c.note}”
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[10rem] whitespace-normal text-xs">
                      <div className="font-medium leading-snug text-foreground">
                        {c.agent.displayName}
                      </div>
                      <div className="mt-0.5 break-all leading-snug text-muted-foreground">
                        {c.agent.email}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[8rem] whitespace-normal text-xs leading-snug">
                      {assignedTo}
                    </TableCell>
                    <TableCell className="max-w-[8rem] whitespace-normal text-xs leading-snug text-muted-foreground">
                      {status}
                    </TableCell>
                    <TableCell>
                      <DateLines
                        enrolled={enrolled}
                        cleared={cleared}
                        dropped={dropped}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "pending" ? "secondary" : "outline"}
                        className="font-normal capitalize"
                      >
                        {c.status}
                      </Badge>
                      {!identity ? (
                        <p className="mt-1 max-w-[6rem] whitespace-normal text-[11px] leading-snug text-amber-800">
                          Not in CRM directory
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      {c.status === "pending" ? (
                        <ClaimReviewForm claimId={c.id} pending />
                      ) : (
                        <div className="max-w-[11.5rem] whitespace-normal text-xs leading-snug text-muted-foreground">
                          {c.adminNote ? <p>{c.adminNote}</p> : <p>—</p>}
                          {c.reviewedBy ? (
                            <p className="mt-0.5">{c.reviewedBy.displayName}</p>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  );
}
