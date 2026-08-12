"use server";

import { requireManagerOrAdmin } from "@/lib/auth-guards";
import { fileKindLabel } from "@/lib/portal/file-labels";
import { lookupAnyFile } from "@/lib/portal/files";
import type { LookupChatResult, LookupHitView } from "@/app/portal/files/lookup-action";

export async function lookupManagerFileChatAction(
  query: string,
): Promise<LookupChatResult> {
  await requireManagerOrAdmin();
  const result = await lookupAnyFile(query);
  const { hits, mode, outcome } = result;
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
    const rep = h.agentName || "unassigned";
    return {
      reply: `Found ${h.clientName || "file"} (External ID ${ext}) on ${rep}'s book — ${
        h.kind === "directory" ? h.crmStatus || "In CRM" : fileKindLabel(h.kind)
      }${h.periodLabel ? ` · ${h.periodLabel}` : ""}. Claim if something looks wrong.`,
      hits: mapped,
    };
  }

  return {
    reply: `Found ${hits.length} files across the team. Refine with an External ID if needed. Claim any that look wrong.`,
    hits: mapped.slice(0, 8),
  };
}
