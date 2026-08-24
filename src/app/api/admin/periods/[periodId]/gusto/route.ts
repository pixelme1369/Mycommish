import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PeriodSource } from "@/generated/prisma/client";
import { buildGustoWorkbook } from "@/lib/gusto/export";
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

  const aliases = await prisma.agentAlias.findMany({
    where: {
      OR: activeRows.map((r) => ({
        agentName: { equals: r.agentName, mode: "insensitive" as const },
      })),
    },
    include: {
      agent: {
        select: {
          employmentType: true,
          companyName: true,
          gustoFirstName: true,
          gustoLastName: true,
          gustoEmployeeId: true,
        },
      },
    },
  });
  const profileByKey = new Map(
    aliases.map((a) => [
      a.agentName.trim().toLowerCase(),
      {
        employmentType: a.agent.employmentType as "employee" | "contractor",
        companyName: a.agent.companyName,
        gustoFirstName: a.agent.gustoFirstName,
        gustoLastName: a.agent.gustoLastName,
        gustoEmployeeId: a.agent.gustoEmployeeId,
      },
    ]),
  );

  const built = await buildGustoWorkbook(
    activeRows.map((r) => {
      const profile = profileByKey.get(r.agentName.trim().toLowerCase());
      return {
        agentPeriodId: r.id,
        agentName: r.agentName,
        netCommission: Number(r.netCommission) || 0,
        employmentType: profile?.employmentType ?? null,
        companyName: profile?.companyName ?? null,
        gustoFirstName: profile?.gustoFirstName ?? null,
        gustoLastName: profile?.gustoLastName ?? null,
        gustoEmployeeId: profile?.gustoEmployeeId ?? null,
      };
    }),
    period.periodLabel,
  );

  if (built.employeeCount + built.contractorCount === 0) {
    return NextResponse.json({ error: "Nothing to export" }, { status: 400 });
  }

  // Metadata for the client toast; file is the attachment.
  const meta = {
    employeeCount: built.employeeCount,
    contractorCount: built.contractorCount,
    missingGustoId: built.missingGustoId,
    missingEin: built.missingEin,
    filename: built.filename,
  };

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${built.filename}"`,
      "Cache-Control": "no-store",
      "X-Gusto-Meta": JSON.stringify(meta),
    },
  });
}
