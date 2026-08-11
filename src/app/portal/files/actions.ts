"use server";

import { revalidatePath } from "next/cache";
import { requireSession, requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";
import { acceptFileClaimReassign } from "@/lib/claims/accept-reassign";

export type ClaimActionState = { ok: true; message: string } | { ok: false; error: string } | null;

async function createPendingClaim(opts: {
  agentId: string;
  crmId: string;
  clientName: string;
  note?: string | null;
}): Promise<ClaimActionState> {
  const crmId = opts.crmId.trim();
  const clientName = opts.clientName.trim();
  if (!crmId) return { ok: false, error: "External ID is required." };
  if (!clientName) return { ok: false, error: "Client name is required." };

  const existing = await prisma.fileClaim.findFirst({
    where: {
      agentId: opts.agentId,
      crmId,
      status: FileClaimStatus.pending,
    },
  });
  if (existing) {
    return { ok: false, error: "You already have a pending claim for this External ID." };
  }

  await prisma.fileClaim.create({
    data: {
      agentId: opts.agentId,
      crmId,
      clientName,
      note: opts.note?.trim() || null,
      status: FileClaimStatus.pending,
    },
  });

  revalidatePath("/portal/files");
  revalidatePath("/admin/claims");
  return { ok: true, message: "Submitted for admin review." };
}

export async function createFileClaimAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  return createPendingClaim({
    agentId,
    crmId: String(formData.get("crmId") || ""),
    clientName: String(formData.get("clientName") || ""),
    note: String(formData.get("note") || "") || null,
  });
}

/** One-click claim from Ask-about-a-file results (External ID + name). */
export async function claimFileFromLookupAction(
  externalId: string,
  clientName: string,
  note?: string,
): Promise<ClaimActionState> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  return createPendingClaim({
    agentId,
    crmId: externalId,
    clientName,
    note: note || "Claimed from file lookup",
  });
}

export async function reviewFileClaimAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const session = await requireAdmin();
  const reviewerId = session.user.agentId;
  if (!reviewerId) return { ok: false, error: "Not signed in." };

  const claimId = String(formData.get("claimId") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const adminNote = String(formData.get("adminNote") || "").trim() || null;

  if (!claimId) return { ok: false, error: "Missing claim." };
  if (decision !== "accepted" && decision !== "rejected") {
    return { ok: false, error: "Invalid decision." };
  }

  if (decision === "accepted") {
    const result = await acceptFileClaimReassign({
      claimId,
      reviewerId,
      adminNote,
    });
    revalidatePath("/admin/claims");
    revalidatePath("/portal/files");
    revalidatePath("/admin");
    return result;
  }

  const claim = await prisma.fileClaim.findUnique({ where: { id: claimId } });
  if (!claim) return { ok: false, error: "Claim not found." };
  if (claim.status !== FileClaimStatus.pending) {
    return { ok: false, error: "Claim was already reviewed." };
  }

  await prisma.fileClaim.update({
    where: { id: claimId },
    data: {
      status: FileClaimStatus.rejected,
      adminNote,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/admin/claims");
  revalidatePath("/portal/files");
  revalidatePath("/admin");

  return { ok: true, message: "Rejected." };
}

export async function listMyFileClaims(agentId: string) {
  return prisma.fileClaim.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listFileClaimsForAdmin() {
  const rows = await prisma.fileClaim.findMany({
    include: {
      agent: { select: { displayName: true, email: true } },
      reviewedBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const rank = (s: FileClaimStatus) =>
    s === FileClaimStatus.pending ? 0 : s === FileClaimStatus.accepted ? 1 : 2;
  return [...rows].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Wipe every FileClaim — clears admin review queue and each agent’s My claims. */
export async function deleteAllFileClaimsAction(): Promise<ClaimActionState> {
  await requireAdmin();
  const result = await prisma.fileClaim.deleteMany({});
  revalidatePath("/admin/claims");
  revalidatePath("/portal/files");
  revalidatePath("/admin");
  return {
    ok: true,
    message:
      result.count === 0
        ? "No claims to delete."
        : `Deleted ${result.count} claim${result.count === 1 ? "" : "s"}.`,
  };
}
