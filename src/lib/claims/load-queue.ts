import { prisma } from "@/lib/db";
import { listFileClaimsForAdmin } from "@/app/portal/files/actions";
import type {
  FileClaimEventHint,
  FileClaimIdentity,
  FileClaimQueueRow,
} from "@/components/file-claims-queue";

export async function loadFileClaimsQueueData(): Promise<{
  claims: FileClaimQueueRow[];
  pendingCount: number;
  totalClaimCount: number;
  identityByClaimId: Map<string, FileClaimIdentity>;
  eventByCrm: Map<string, FileClaimEventHint>;
}> {
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

  const identityByClaimId = new Map<string, FileClaimIdentity>();
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

  const eventByCrm = new Map<string, FileClaimEventHint>();
  for (const e of latestEvents) {
    if (!eventByCrm.has(e.crmId)) {
      eventByCrm.set(e.crmId, {
        crmId: e.crmId,
        kind: String(e.kind),
        agentName: e.agentName,
        enrolledDate: e.enrolledDate,
        firstPaymentClearedDate: e.firstPaymentClearedDate,
        droppedDate: e.droppedDate,
      });
    }
  }

  return {
    claims,
    pendingCount,
    totalClaimCount,
    identityByClaimId,
    eventByCrm,
  };
}
