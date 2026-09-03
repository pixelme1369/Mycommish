import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewAllCommissions } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ documentId: string }> },
) {
  const session = await auth();
  if (!session?.user || !canViewAllCommissions(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await ctx.params;
  const row = await prisma.agentDocument.findFirst({
    where: { id: documentId },
    select: { filename: true, contentType: true, pdfBytes: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(row.pdfBytes);
  const filename = (row.filename || "document.pdf").replace(/"/g, "");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": row.contentType || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
