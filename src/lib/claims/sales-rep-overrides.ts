import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";

export { applySalesRepOverrides } from "@/lib/claims/apply-sales-rep-overrides";

/**
 * Accepted file claims → Sales Rep overrides for CRM ingest.
 * Keys include claim External ID / CRM ID plus resolved identity crmId + externalId.
 * Later accepts win when the same file was reassigned.
 */
export async function loadAcceptedSalesRepOverrides(): Promise<Map<string, string>> {
  const claims = await prisma.fileClaim.findMany({
    where: { status: FileClaimStatus.accepted },
    include: {
      agent: {
        include: { aliases: { orderBy: { agentName: "asc" }, take: 1 } },
      },
    },
    orderBy: [{ reviewedAt: "asc" }, { updatedAt: "asc" }],
  });

  const map = new Map<string, string>();
  if (!claims.length) return map;

  const claimKeys = [
    ...new Set(claims.map((c) => c.crmId.trim()).filter(Boolean)),
  ];

  const identities =
    claimKeys.length > 0
      ? await prisma.clientIdentity.findMany({
          where: {
            OR: [{ externalId: { in: claimKeys } }, { crmId: { in: claimKeys } }],
          },
          select: { crmId: true, externalId: true },
        })
      : [];

  const identityByClaimKey = new Map<string, { crmId: string; externalId: string | null }>();
  for (const id of identities) {
    identityByClaimKey.set(id.crmId, id);
    if (id.externalId) identityByClaimKey.set(id.externalId, id);
  }

  for (const claim of claims) {
    const salesRep =
      claim.assignedSalesRep?.trim() ||
      claim.agent.aliases[0]?.agentName?.trim() ||
      "";
    if (!salesRep) continue;

    const claimKey = claim.crmId.trim();
    if (!claimKey) continue;
    map.set(claimKey, salesRep);

    const identity = identityByClaimKey.get(claimKey);
    if (!identity) continue;
    map.set(identity.crmId, salesRep);
    const ext = identity.externalId?.trim();
    if (ext) map.set(ext, salesRep);
  }

  return map;
}
