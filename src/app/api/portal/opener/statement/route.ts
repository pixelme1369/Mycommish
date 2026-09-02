import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewAllCommissions } from "@/lib/auth-guards";
import { isOpenerRole } from "@/lib/roles";
import { buildOpenerCommissionStatementPdf } from "@/lib/export/opener-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.agentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") || "";
  const month = url.searchParams.get("month") || "";
  if (!agentId || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const staff = canViewAllCommissions(session);
  const own = isOpenerRole(session.user.role) && session.user.agentId === agentId;
  if (!staff && !own) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const built = await buildOpenerCommissionStatementPdf({ agentId, monthLabel: month });
  if (!built) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inline = url.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${built.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
