import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import { buildCommissionHistoryWorkbook } from "@/lib/export/commission-history";
import { dismissalKey, listDismissedKeys } from "@/lib/agents/dismissal";
import {
  exclusionKey,
  listExcludedKeysForPeriod,
} from "@/lib/agents/period-exclusion";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ periodId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { periodId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    agentPeriodIds?: string[];
  } | null;
  const ids = Array.isArray(body?.agentPeriodIds)
    ? body!.agentPeriodIds.filter((id) => typeof id === "string" && id)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one agent" }, { status: 400 });
  }

  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  const rows = await prisma.agentPeriod.findMany({
    where: { periodId, id: { in: ids } },
    orderBy: { agentName: "asc" },
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "No matching agents" }, { status: 404 });
  }

  const [dismissedKeys, excludedKeys] = await Promise.all([
    listDismissedKeys(),
    listExcludedKeysForPeriod(period.periodLabel),
  ]);
  const activeRows = rows.filter(
    (r) =>
      !dismissedKeys.has(dismissalKey(r.agentName)) &&
      !excludedKeys.has(exclusionKey(r.agentName)),
  );
  if (activeRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Selected agents are dismissed or removed from this period — restore them first, or pick active agents",
      },
      { status: 400 },
    );
  }

  const built = await buildCommissionHistoryWorkbook({
    periodId,
    agentPeriodIds: activeRows.map((r) => r.id),
  });

  if (!built) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  if (built.rowCount === 0) {
    return NextResponse.json(
      { error: "No client rows to export for the selected agents" },
      { status: 400 },
    );
  }

  const meta = {
    rowCount: built.rowCount,
    agentCount: activeRows.length,
    filename: built.filename,
  };

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${built.filename}"`,
      "Cache-Control": "no-store",
      "X-Commission-History-Meta": JSON.stringify(meta),
    },
  });
}
