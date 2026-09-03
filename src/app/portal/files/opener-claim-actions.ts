"use server";

import { revalidatePath } from "next/cache";
import { requireOpener, requireSuperAdmin } from "@/lib/auth-guards";
import {
  createOpenerFileClaim,
  listMyOpenerFileClaims,
  listOpenerFileClaimsForAdmin,
  lookupOpenerFile,
  reviewOpenerFileClaim,
  type OpenerFileLookupResult,
} from "@/lib/opener/file-claims";
import type { LookupChatResult } from "@/app/portal/files/lookup-action";
import type { ClaimActionState } from "@/app/portal/files/actions";
import { money } from "@/lib/format";

export type { ClaimActionState };

/** Adapt opener Forth lookup into the shared FileLookupChat result shape. */
export async function lookupOpenerFileChatAction(
  query: string,
): Promise<LookupChatResult> {
  await requireOpener();
  const result: OpenerFileLookupResult = await lookupOpenerFile(query);
  return {
    reply: result.reply,
    hits: result.hits.map((h) => ({
      crmId: h.forthId,
      externalId: h.forthId,
      clientName: h.clientName,
      kindLabel: [
        h.kindLabel,
        h.transferAgent ? `Transfer Agent: ${h.transferAgent}` : "No Transfer Agent",
        h.tpId && h.tpId !== h.forthId ? `Cordoba ${h.tpId}` : null,
        h.debtLoad > 0 ? `Debt ${money(h.debtLoad)}` : null,
        h.status ? `Status: ${h.status}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      enrolledDate: h.enrolledDate,
      firstPaymentClearedDate: h.transferredDate,
      droppedDate: null,
      periodLabel: h.transferredDate?.slice(0, 7) ?? null,
      claimable: h.claimable,
    })),
    claimDraft: result.claimDraft
      ? {
          externalId: result.claimDraft.forthId,
          clientName: result.claimDraft.clientName,
        }
      : null,
  };
}

export async function claimOpenerFileFromLookupAction(
  forthId: string,
  clientName: string,
  note?: string,
): Promise<ClaimActionState> {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const lookup = await lookupOpenerFile(forthId);
  const res = await createOpenerFileClaim({
    agentId,
    forthId,
    clientName,
    note: note || "Claimed from opener file lookup",
    transferAgentSnapshot: lookup.transferAgentSnapshot ?? lookup.hits[0]?.transferAgent ?? null,
    enrolledSnapshot:
      lookup.enrolledSnapshot ?? lookup.hits[0]?.enrolled ?? false,
  });
  if (res.ok) {
    revalidatePath("/portal/files");
    revalidatePath("/admin/opener-claims");
  }
  return res;
}

export async function createOpenerFileClaimAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const forthId = String(formData.get("forthId") || formData.get("crmId") || "");
  const lookup = await lookupOpenerFile(forthId);
  const res = await createOpenerFileClaim({
    agentId,
    forthId,
    clientName: String(formData.get("clientName") || ""),
    note: String(formData.get("note") || "") || null,
    transferAgentSnapshot: lookup.transferAgentSnapshot ?? lookup.hits[0]?.transferAgent ?? null,
    enrolledSnapshot:
      lookup.enrolledSnapshot ?? lookup.hits[0]?.enrolled ?? false,
  });
  if (res.ok) {
    revalidatePath("/portal/files");
    revalidatePath("/admin/opener-claims");
  }
  return res;
}

export async function listMyOpenerClaimsAction() {
  const session = await requireOpener();
  const agentId = session.user.agentId;
  if (!agentId) return [];
  return listMyOpenerFileClaims(agentId);
}

export async function reviewOpenerFileClaimAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const session = await requireSuperAdmin();
  const reviewerId = session.user.agentId;
  if (!reviewerId) return { ok: false, error: "Not signed in." };

  const claimId = String(formData.get("claimId") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const adminNote = String(formData.get("adminNote") || "").trim() || null;
  if (!claimId) return { ok: false, error: "Missing claim." };
  if (decision !== "accepted" && decision !== "rejected") {
    return { ok: false, error: "Invalid decision." };
  }

  const res = await reviewOpenerFileClaim({
    claimId,
    reviewerId,
    decision,
    adminNote,
  });
  if (res.ok) {
    revalidatePath("/admin/opener-claims");
    revalidatePath("/portal/files");
    revalidatePath("/admin/openers");
    revalidatePath("/portal");
  }
  return res;
}

export async function loadOpenerClaimsForAdminAction() {
  await requireSuperAdmin();
  return listOpenerFileClaimsForAdmin();
}
