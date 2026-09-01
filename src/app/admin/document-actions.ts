"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { listDocumentRecipients } from "@/lib/portal/signed-documents";

export type SendDocumentResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const MAX_PDF_BYTES = 8 * 1024 * 1024;

export async function sendDocumentToAllAgentsAction(
  _prev: SendDocumentResult | null,
  formData: FormData,
): Promise<SendDocumentResult> {
  const session = await requireAdmin();
  const createdById = session.user.agentId;
  if (!createdById) return { ok: false, error: "Not signed in." };

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

  const recipients = await listDocumentRecipients();
  if (!recipients.length) {
    return { ok: false, error: "No agents to send to." };
  }

  await prisma.$transaction(async (tx) => {
    const doc = await tx.agentDocument.create({
      data: {
        title,
        filename: name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120),
        contentType: "application/pdf",
        pdfBytes: new Uint8Array(buf),
        createdById,
      },
    });
    await tx.agentDocumentSignature.createMany({
      data: recipients.map((r) => ({
        documentId: doc.id,
        agentId: r.id,
      })),
    });
  });

  revalidatePath("/admin/manual-inputs");
  revalidatePath("/portal/documents");
  return {
    ok: true,
    message: `Sent “${title}” to ${recipients.length} agent${recipients.length === 1 ? "" : "s"}.`,
  };
}
