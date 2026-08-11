"use server";

import { requireSession } from "@/lib/auth-guards";
import { fileKindLabel } from "@/lib/portal/file-labels";
import { lookupAgentFiles } from "@/lib/portal/files";

export type LookupHitView = {
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  kindLabel: string;
  enrolledDate: string | null;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  periodLabel: string | null;
  /** Show Claim when the agent may need admin review for this file. */
  claimable: boolean;
};

export type LookupChatResult = {
  reply: string;
  hits: LookupHitView[];
  /** When not found / not assigned — still offer one-click claim. */
  claimDraft?: { externalId: string; clientName: string } | null;
};

export async function lookupFileChatAction(query: string): Promise<LookupChatResult> {
  const session = await requireSession();
  const aliasNames = session.user.aliasNames || [];
  const result = await lookupAgentFiles(aliasNames, query);
  const { hits, mode, outcome, otherRep } = result;
  const q = query.trim();

  const mapped: LookupHitView[] = hits.map((h) => ({
    crmId: h.crmId,
    externalId: h.externalId,
    clientName: h.clientName,
    kindLabel:
      h.kind === "not_yet_cleared"
        ? "Not yet cleared"
        : h.kind === "directory"
          ? h.crmStatus || "In CRM"
          : fileKindLabel(h.kind),
    enrolledDate: h.enrolledDate,
    firstPaymentClearedDate: h.firstPaymentClearedDate,
    droppedDate: h.droppedDate,
    periodLabel: h.periodLabel,
    claimable: true,
  }));

  if (outcome === "no_aliases") {
    return {
      reply: "Your login has no CRM aliases yet — ask an admin to map your Sales Rep name.",
      hits: [],
    };
  }

  if (outcome === "not_assigned" && otherRep) {
    const ext = otherRep.externalId || otherRep.crmId;
    return {
      reply: `This file is not assigned to you. CRM Sales Rep is ${otherRep.agentName}${
        otherRep.clientName
          ? ` (${otherRep.clientName}; External ID ${ext})`
          : ` (External ID ${ext})`
      }. You can claim it for admin review.`,
      hits: [],
      claimDraft: {
        externalId: ext,
        clientName: otherRep.clientName || "Unknown",
      },
    };
  }

  if (outcome === "not_found") {
    return {
      reply:
        mode === "id"
          ? `No file with External ID ${q} in uploaded CRM data. You can claim it for admin review.`
          : `No files matching “${q}” in uploaded CRM data. Try External ID, or claim with External ID + name below.`,
      hits: [],
      claimDraft:
        mode === "id"
          ? { externalId: q, clientName: "Unknown — verify name" }
          : null,
    };
  }

  if (outcome === "assigned" && hits.length === 1) {
    const h = hits[0];
    const ext = h.externalId || h.crmId;
    const pendingStatus =
      h.kind === "pending" ||
      (h.crmStatus || "").toLowerCase().includes("pending affiliate cancellation");

    if (pendingStatus) {
      return {
        reply: `${h.clientName || "This file"} (External ID ${ext}) is on your book, but it is in Pending Affiliate Cancellation — so it is held and not included in your paid commission units yet.${
          h.firstPaymentClearedDate
            ? ` 1st payment cleared: ${h.firstPaymentClearedDate}.`
            : ""
        }`,
        hits: mapped,
      };
    }

    if (h.kind === "not_yet_cleared") {
      return {
        reply: `${h.clientName || "This file"} (External ID ${ext}) is on your book in CRM, but the 1st payment has not cleared yet — so it is not included in your commission.`,
        hits: mapped,
      };
    }

    return {
      reply: `Found ${h.clientName || "file"} (External ID ${ext}) — ${
        h.kind === "directory" ? h.crmStatus || "In CRM" : fileKindLabel(h.kind)
      }.`,
      hits: mapped,
    };
  }

  return {
    reply: `Found ${hits.length} files on your book. Refine with an External ID if this isn’t the right one.`,
    hits: mapped.slice(0, 8),
  };
}
