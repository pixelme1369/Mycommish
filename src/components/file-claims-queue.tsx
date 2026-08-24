import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClaimReviewForm } from "@/app/admin/claims/review-form";

export type FileClaimQueueRow = {
  id: string;
  crmId: string;
  clientName: string;
  note: string | null;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  agent: { displayName: string; email: string };
  reviewedBy: { displayName: string } | null;
};

export type FileClaimIdentity = {
  crmId: string;
  externalId: string | null;
  salesRep: string | null;
  clientName: string | null;
  crmStatus: string | null;
  enrolledDate: string | null;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
};

export type FileClaimEventHint = {
  crmId: string;
  kind: string;
  agentName: string;
  enrolledDate: string | null;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
};

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

function formatClaimRequestedAt(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FileClaimsQueue({
  claims,
  identityByClaimId,
  eventByCrm,
}: {
  claims: FileClaimQueueRow[];
  identityByClaimId: Map<string, FileClaimIdentity>;
  eventByCrm: Map<string, FileClaimEventHint>;
}) {
  if (claims.length === 0) {
    return (
      <Card className="glass-panel mt-8 p-4 text-sm text-muted-foreground">
        No claims yet.
      </Card>
    );
  }

  return (
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
            const enrolled = event?.enrolledDate || identity?.enrolledDate || "—";
            const cleared =
              event?.firstPaymentClearedDate ||
              identity?.firstPaymentClearedDate ||
              "—";
            const dropped = event?.droppedDate || identity?.droppedDate || "—";
            const name = identity?.clientName || c.clientName;
            const assignedTo = identity?.salesRep || event?.agentName || "—";

            return (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.crmId}</TableCell>
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
                  <div className="mt-1 leading-snug text-muted-foreground">
                    <span className="text-foreground/50">Requested </span>
                    {formatClaimRequestedAt(c.createdAt)}
                  </div>
                </TableCell>
                <TableCell className="max-w-[8rem] whitespace-normal text-xs leading-snug">
                  {assignedTo}
                </TableCell>
                <TableCell className="max-w-[8rem] whitespace-normal text-xs leading-snug text-muted-foreground">
                  {status}
                </TableCell>
                <TableCell>
                  <DateLines enrolled={enrolled} cleared={cleared} dropped={dropped} />
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
  );
}
