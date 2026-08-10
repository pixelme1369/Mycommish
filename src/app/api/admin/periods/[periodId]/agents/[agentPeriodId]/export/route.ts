import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAgentPeriodWorkbook } from "@/lib/export/agent-xlsx";

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
  const built = await buildAgentPeriodWorkbook(periodId, agentPeriodId);
  if (!built) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${built.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
