import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canViewAllCommissions } from "@/lib/auth-guards";
import { buildOpenerPeriodWorkbook } from "@/lib/export/opener-xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !canViewAllCommissions(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = new URL(req.url).searchParams.get("month") || "";
  const built = await buildOpenerPeriodWorkbook(month);
  if (!built) {
    return NextResponse.json({ error: "Invalid pay period." }, { status: 400 });
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
