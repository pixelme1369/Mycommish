import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canViewAllCommissions } from "@/lib/auth-guards";
import { buildSignedStatementPdf } from "@/lib/statements";
import { PeriodSource } from "@/generated/prisma/client";
import { listDismissedKeys } from "@/lib/agents/dismissal";
import { agentIdentityKey } from "@/lib/commission/calculator";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ periodId: string; agentPeriodId: string }> },
) {
  const session = await auth();
  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId, agentPeriodId } = await ctx.params;
  const row = await prisma.agentPeriod.findFirst({
    where: {
      id: agentPeriodId,
      periodId,
      period: { source: PeriodSource.calculated },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const staff = canViewAllCommissions(session as never);
  if (!staff) {
    const aliases = new Set(
      (session.user.aliasNames || []).map((n) => n.toLowerCase()),
    );
    const dismissed = await listDismissedKeys();
    if (
      !aliases.has(row.agentName.toLowerCase()) ||
      dismissed.has(agentIdentityKey(row.agentName))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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
