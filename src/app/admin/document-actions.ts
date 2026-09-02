"use server";

import { revalidatePath } from "next/cache";
import { AgentDocumentSignStatus, AgentRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { listDocumentRecipients } from "@/lib/portal/signed-documents";
import type { SendDocumentResult } from "@/app/admin/document-action-types";

const MAX_PDF_BYTES = 8 * 1024 * 1024;

async function readPdfFromForm(formData: FormData): Promise<
  | { ok: true; title: string; filename: string; buf: Buffer }
  | { ok: false; error: string }
> {
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2) {
    return { ok: false, error: "Give the document a title." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 16) {
    return { ok: false, error: "Upload a PDF." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "PDF must be 8 MB or smaller." };
  }
  const type = (file.type || "").toLowerCase();
  const name = file.name || "document.pdf";
  if (type && type !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Only PDF files can be sent." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    return { ok: false, error: "That file doesn’t look like a PDF." };
  }

  return {
    ok: true,
    title,
    filename: name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120),
    buf,
  };
}

async function resolveRecipientIds(
  audience: string,
  agentIdRaw: string,
): Promise<{ ids: string[]; error?: string; oneName?: string }> {
  if (audience === "one") {
    const agentId = agentIdRaw.trim();
    if (!agentId) return { ids: [], error: "Pick an agent." };
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, role: { not: AgentRole.super_admin } },
      select: { id: true, displayName: true },
    });
    if (!agent) return { ids: [], error: "Agent not found." };
    return { ids: [agent.id], oneName: agent.displayName };
  }
  const recipients = await listDocumentRecipients();
  if (!recipients.length) return { ids: [], error: "No agents to send to." };
  return { ids: recipients.map((r) => r.id) };
}

export async function sendAgentDocumentAction(
  _prev: SendDocumentResult | null,
  formData: FormData,
): Promise<SendDocumentResult> {
  const session = await requireAdmin();
  const createdById = session.user.agentId;
  if (!createdById) return { ok: false, error: "Not signed in." };

  const parsed = await readPdfFromForm(formData);
  if (!parsed.ok) return parsed;

  const audience = String(formData.get("audience") || "all").trim();
  const intent = String(formData.get("intent") || "sign").trim();
  const filedRecord = intent === "file";
  const recipients = await resolveRecipientIds(
    audience,
    String(formData.get("agentId") || ""),
  );
  if (recipients.error) return { ok: false, error: recipients.error };
  if (filedRecord && recipients.ids.length !== 1) {
    return { ok: false, error: "File a signed copy for one agent at a time." };
  }

  const displayName =
    filedRecord && recipients.oneName ? recipients.oneName : null;

  await prisma.$transaction(async (tx) => {
    const doc = await tx.agentDocument.create({
      data: {
        title: parsed.title,
        filename: parsed.filename,
        contentType: "application/pdf",
        pdfBytes: new Uint8Array(parsed.buf),
        createdById,
        filedRecord,
      },
    });
    if (filedRecord) {
      await tx.agentDocumentSignature.create({
        data: {
          documentId: doc.id,
          agentId: recipients.ids[0]!,
          status: AgentDocumentSignStatus.signed,
          typedName: displayName || "Physical copy on file",
          signedAt: new Date(),
        },
      });
    } else {
      await tx.agentDocumentSignature.createMany({
        data: recipients.ids.map((id) => ({
          documentId: doc.id,
          agentId: id,
        })),
      });
    }
  });

  revalidatePath("/admin/manual-inputs");
  revalidatePath("/admin/agents");
  revalidatePath("/admin/documents");
  revalidatePath("/portal/documents");

  if (filedRecord) {
    return {
      ok: true,
      message: `Filed “${parsed.title}” on ${recipients.oneName || "that agent"}’s records.`,
    };
  }
  const n = recipients.ids.length;
  return {
    ok: true,
    message: `Sent “${parsed.title}” to ${n} agent${n === 1 ? "" : "s"} to sign.`,
  };
}
