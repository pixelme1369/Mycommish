import { prisma } from "@/lib/db";
import { FileClaimStatus } from "@/generated/prisma/client";
import { findOpenerPlanAgent } from "@/lib/agents/opener";
import {
  findForthContactForOpenerId,
  existingOpenerLog,
} from "@/lib/opener/logs";
import {
  normalizeForthId,
  openerCommissionForPayStatus,
  openerSnapshotFromForth,
  OPENER_MIN_PERIOD_LABEL,
} from "@/lib/opener/payout";
import { pacificTodayYmd, pacificYmdFromInstant } from "@/lib/portal/daily-tasks-dates";

export type OpenerFileLookupHit = {
  forthId: string;
  tpId: string | null;
  clientName: string;
  transferAgent: string | null;
  enrolled: boolean;
  enrolledDate: string | null;
  transferredDate: string | null;
  stageTitle: string | null;
  status: string | null;
  debtLoad: number;
  kindLabel: string;
  claimable: boolean;
};

export type OpenerFileLookupResult = {
  reply: string;
  hits: OpenerFileLookupHit[];
  claimDraft?: { forthId: string; clientName: string } | null;
  transferAgentSnapshot?: string | null;
  enrolledSnapshot?: boolean | null;
};

function clientNameFromContact(c: {
  clientFirstName: string | null;
  clientLastName: string | null;
}): string {
  const parts = [c.clientFirstName, c.clientLastName].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown";
}

export async function lookupOpenerFile(query: string): Promise<OpenerFileLookupResult> {
  const q = normalizeForthId(query);
  if (!q) {
    return { reply: "Enter a File ID (Forth or Cordoba External ID).", hits: [] };
  }

  // Prefer exact File ID (Forth id or Cordoba tp id).
  const byId = await findForthContactForOpenerId(q);
  if (byId) {
    const full = await prisma.forthContact.findUnique({
      where: { forthId: byId.forthId },
      select: {
        forthId: true,
        tpId: true,
        clientFirstName: true,
        clientLastName: true,
        transferAgent: true,
        enrolledDate: true,
        transferredDate: true,
        stageTitle: true,
        status: true,
        enrolledAmount: true,
      },
    });
    if (!full) {
      return {
        reply: `No Forth file for ${q}. You can still claim it for super-admin review.`,
        hits: [],
        claimDraft: { forthId: q, clientName: "Unknown — verify name" },
        transferAgentSnapshot: null,
        enrolledSnapshot: false,
      };
    }

    const enrolled = Boolean(full.enrolledDate);
    const snap = openerSnapshotFromForth(full);
    const clientName = clientNameFromContact(full);
    const existing = await existingOpenerLog(full.forthId);
    const hit: OpenerFileLookupHit = {
      forthId: full.forthId,
      tpId: full.tpId,
      clientName,
      transferAgent: full.transferAgent,
      enrolled,
      enrolledDate: full.enrolledDate ? pacificYmdFromInstant(full.enrolledDate) : null,
      transferredDate: full.transferredDate
        ? pacificYmdFromInstant(full.transferredDate)
        : null,
      stageTitle: full.stageTitle,
      status: full.status,
      debtLoad: snap.debtLoad,
      kindLabel: enrolled ? "Enrolled" : "Not Enrolled",
      claimable: true,
    };

    let reply = `${clientName} (File ID ${full.forthId}${
      full.tpId && full.tpId !== full.forthId ? ` / Cordoba ${full.tpId}` : ""
    }).`;
    reply += enrolled
      ? ` This file is enrolled.`
      : ` This file is Not Enrolled.`;
    reply += full.transferAgent
      ? ` Transfer Agent is ${full.transferAgent}.`
      : ` No Transfer Agent is set yet.`;
    if (full.stageTitle) reply += ` Stage: ${full.stageTitle}.`;
    if (full.status) reply += ` Status: ${full.status}.`;
    if (!snap.unmatched && snap.debtLoad > 0) {
      reply += ` Debt load ${snap.debtLoad.toLocaleString("en-US", { style: "currency", currency: "USD" })}.`;
    }
    if (existing) {
      reply += ` Already on ${existing.agent.displayName}'s transfer log.`;
    }
    reply += ` You can still claim it for super-admin review if needed.`;

    return {
      reply,
      hits: [hit],
      // Hit already has Claim — don't also render claimDraft (duplicate button).
      claimDraft: null,
      transferAgentSnapshot: full.transferAgent,
      enrolledSnapshot: enrolled,
    };
  }

  // Name search (optional fallback).
  const nameHits = await prisma.forthContact.findMany({
    where: {
      OR: [
        { clientFirstName: { contains: q, mode: "insensitive" } },
        { clientLastName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      forthId: true,
      tpId: true,
      clientFirstName: true,
      clientLastName: true,
      transferAgent: true,
      enrolledDate: true,
      transferredDate: true,
      stageTitle: true,
      status: true,
      enrolledAmount: true,
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  if (nameHits.length) {
    const hits: OpenerFileLookupHit[] = nameHits.map((full) => {
      const enrolled = Boolean(full.enrolledDate);
      const snap = openerSnapshotFromForth(full);
      return {
        forthId: full.forthId,
        tpId: full.tpId,
        clientName: clientNameFromContact(full),
        transferAgent: full.transferAgent,
        enrolled,
        enrolledDate: full.enrolledDate ? pacificYmdFromInstant(full.enrolledDate) : null,
        transferredDate: full.transferredDate
          ? pacificYmdFromInstant(full.transferredDate)
          : null,
        stageTitle: full.stageTitle,
        status: full.status,
        debtLoad: snap.debtLoad,
        kindLabel: enrolled ? "Enrolled" : "Not Enrolled",
        claimable: true,
      };
    });
    return {
      reply: `Found ${hits.length} file${hits.length === 1 ? "" : "s"} matching “${q}”. Claim any that should be yours for super-admin review.`,
      hits,
    };
  }

  return {
    reply: `No Forth file with ID ${q}. You can still claim it for super-admin review.`,
    hits: [],
    claimDraft: { forthId: q, clientName: "Unknown — verify name" },
    transferAgentSnapshot: null,
    enrolledSnapshot: false,
  };
}

export async function listMyOpenerFileClaims(agentId: string) {
  return prisma.openerFileClaim.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listOpenerFileClaimsForAdmin() {
  return prisma.openerFileClaim.findMany({
    include: {
      agent: { select: { displayName: true, email: true } },
      reviewedBy: { select: { displayName: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function createOpenerFileClaim(opts: {
  agentId: string;
  forthId: string;
  clientName: string;
  note?: string | null;
  transferAgentSnapshot?: string | null;
  enrolledSnapshot?: boolean | null;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!(await findOpenerPlanAgent(opts.agentId))) {
    return { ok: false, error: "Opener login required." };
  }
  const forthId = normalizeForthId(opts.forthId);
  const clientName = opts.clientName.trim();
  if (!forthId) return { ok: false, error: "File ID is required." };
  if (!clientName) return { ok: false, error: "Client name is required." };

  const existing = await prisma.openerFileClaim.findFirst({
    where: {
      agentId: opts.agentId,
      forthId,
      status: FileClaimStatus.pending,
    },
  });
  if (existing) {
    return { ok: false, error: "You already have a pending claim for this File ID." };
  }

  await prisma.openerFileClaim.create({
    data: {
      agentId: opts.agentId,
      forthId,
      clientName,
      note: opts.note?.trim() || null,
      transferAgentSnapshot: opts.transferAgentSnapshot?.trim() || null,
      enrolledSnapshot: opts.enrolledSnapshot ?? null,
      status: FileClaimStatus.pending,
    },
  });

  return { ok: true, message: "Submitted for super-admin review." };
}

/**
 * Accept: put the file on the claimer's opener transfer log (create or reassign).
 * Reject: mark rejected only.
 */
export async function reviewOpenerFileClaim(opts: {
  claimId: string;
  reviewerId: string;
  decision: "accepted" | "rejected";
  adminNote?: string | null;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const claim = await prisma.openerFileClaim.findUnique({
    where: { id: opts.claimId },
  });
  if (!claim) return { ok: false, error: "Claim not found." };
  if (claim.status !== FileClaimStatus.pending) {
    return { ok: false, error: "Claim already reviewed." };
  }

  if (opts.decision === "rejected") {
    await prisma.openerFileClaim.update({
      where: { id: claim.id },
      data: {
        status: FileClaimStatus.rejected,
        adminNote: opts.adminNote?.trim() || null,
        reviewedById: opts.reviewerId,
        reviewedAt: new Date(),
      },
    });
    return { ok: true, message: "Claim rejected." };
  }

  const contact = await findForthContactForOpenerId(claim.forthId);
  const full = contact
    ? await prisma.forthContact.findUnique({
        where: { forthId: contact.forthId },
        select: {
          forthId: true,
          tpId: true,
          enrolledAmount: true,
          stageTitle: true,
          status: true,
          transferredDate: true,
        },
      })
    : null;

  const forthId = full?.forthId || claim.forthId;
  const snap = openerSnapshotFromForth(full);
  const transferYmd =
    full?.transferredDate
      ? pacificYmdFromInstant(full.transferredDate)
      : pacificTodayYmd();
  const month = transferYmd.slice(0, 7);
  const safeYmd =
    month >= OPENER_MIN_PERIOD_LABEL ? transferYmd : `${OPENER_MIN_PERIOD_LABEL}-01`;

  const existing = await prisma.openerTransferLog.findFirst({
    where: {
      OR: [
        { forthId },
        ...(full?.tpId ? [{ forthId: full.tpId }] : []),
        { forthId: claim.forthId },
      ],
    },
  });

  if (existing) {
    await prisma.openerTransferLog.update({
      where: { id: existing.id },
      data: {
        agentId: claim.agentId,
        forthId,
        transferYmd: safeYmd,
        debtLoad: snap.debtLoad,
        stageTitle: snap.stageTitle,
        status: snap.status,
        commission: openerCommissionForPayStatus(snap.debtLoad, snap.payStatus),
        payStatus: snap.payStatus,
        unmatched: snap.unmatched,
      },
    });
  } else {
    await prisma.openerTransferLog.create({
      data: {
        agentId: claim.agentId,
        forthId,
        transferYmd: safeYmd,
        debtLoad: snap.debtLoad,
        stageTitle: snap.stageTitle,
        status: snap.status,
        commission: openerCommissionForPayStatus(snap.debtLoad, snap.payStatus),
        payStatus: snap.payStatus,
        unmatched: snap.unmatched,
      },
    });
  }

  await prisma.openerFileClaim.update({
    where: { id: claim.id },
    data: {
      status: FileClaimStatus.accepted,
      adminNote: opts.adminNote?.trim() || null,
      reviewedById: opts.reviewerId,
      reviewedAt: new Date(),
    },
  });

  return { ok: true, message: "Claim accepted — transfer assigned to opener." };
}
