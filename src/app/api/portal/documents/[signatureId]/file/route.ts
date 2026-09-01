import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ signatureId: string }> },
) {
  const session = await auth();
  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { signatureId } = await ctx.params;
  const row = await prisma.agentDocumentSignature.findFirst({
    where: { id: signatureId, agentId: session.user.agentId },
    include: { document: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(row.document.pdfBytes);
  const filename = (row.document.filename || "document.pdf").replace(/"/g, "");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": row.document.contentType || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
