import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewAllCommissions } from "@/lib/auth-guards";
import { buildSignedStatementPdf } from "@/lib/statements";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ periodId: string; agentPeriodId: string }> },
) {
  const session = await auth();
  if (!session?.user || !canViewAllCommissions(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId, agentPeriodId } = await ctx.params;
  const built = await buildSignedStatementPdf(periodId, agentPeriodId);
  if (!built) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${built.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
