import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { dismissalKey } from "@/lib/agents/dismissal";
import { prisma } from "@/lib/db";
import { buildLastPaysWorkbook, loadLastPays } from "@/lib/agents/last-check-load";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ agentNameKey: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentNameKey: rawKey } = await ctx.params;
  const agentNameKey = dismissalKey(decodeURIComponent(rawKey));
  const dismissal = await prisma.salesRepDismissal.findUnique({
    where: { agentNameKey },
  });
  if (!dismissal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await loadLastPays(dismissal.agentName);
  if (!rows.length) {
    return NextResponse.json({ error: "No last pays to export." }, { status: 400 });
  }

  const built = await buildLastPaysWorkbook({
    agentName: dismissal.agentName,
    rows,
  });
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
