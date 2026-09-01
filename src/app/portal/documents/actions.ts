"use server";

import { revalidatePath } from "next/cache";
import { AgentDocumentSignStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-guards";
import { parseSignatureDataUrl } from "@/lib/statements";

export type SignCompanyDocResult = { ok: true } | { ok: false; error: string };

export async function signCompanyDocumentAction(input: {
  signatureId: string;
  signatureDataUrl?: string | null;
}): Promise<SignCompanyDocResult> {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return { ok: false, error: "Not signed in." };

  const typedName = (session.user.displayName || "").trim();
  if (typedName.length < 2) {
    return { ok: false, error: "Your account needs a full name before you can sign." };
  }

  const buf = parseSignatureDataUrl(input.signatureDataUrl);
  if (!buf) return { ok: false, error: "Add a signature style or drawing." };
  const png = new Uint8Array(buf.byteLength);
  png.set(buf);

  const row = await prisma.agentDocumentSignature.findFirst({
    where: { id: input.signatureId, agentId },
  });
  if (!row) return { ok: false, error: "Document not found." };
  if (row.status === AgentDocumentSignStatus.signed) {
    return { ok: false, error: "Already signed." };
  }

  await prisma.agentDocumentSignature.update({
    where: { id: row.id },
    data: {
      status: AgentDocumentSignStatus.signed,
      typedName,
      signaturePng: png,
      signedAt: new Date(),
    },
  });

  revalidatePath("/portal/documents");
  return { ok: true };
}
