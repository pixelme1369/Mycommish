import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAgentCommissionStatementPdf } from "@/lib/export/agent-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ periodId: string; agentPeriodId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId, agentPeriodId } = await ctx.params;
  const built = await buildAgentCommissionStatementPdf(periodId, agentPeriodId);
  if (!built) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${built.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
