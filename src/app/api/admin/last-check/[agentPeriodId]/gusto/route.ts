import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildGustoWorkbook } from "@/lib/gusto/export";
import { loadLastCheck } from "@/lib/agents/last-check-load";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ agentPeriodId: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentPeriodId } = await ctx.params;
  const view = await loadLastCheck(agentPeriodId);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (view.gustoAmount <= 0) {
    return NextResponse.json({ error: "Nothing to pay on Gusto." }, { status: 400 });
  }

  const built = await buildGustoWorkbook(
    [
      {
        agentPeriodId: view.agentPeriodId,
        agentName: view.agentName,
        netCommission: view.gustoAmount,
        employmentType: view.employmentType,
        companyName: view.companyName,
        gustoFirstName: view.gustoFirstName,
        gustoLastName: view.gustoLastName,
        gustoEmployeeId: view.gustoEmployeeId,
      },
    ],
    `${view.periodLabel} last check`,
  );

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
