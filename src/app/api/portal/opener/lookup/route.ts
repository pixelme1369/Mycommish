import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOpenerRole } from "@/lib/roles";
import { normalizeForthId } from "@/lib/opener/payout";
import { existingOpenerLog, lookupForthForOpener, matchedDebtTooLow } from "@/lib/opener/logs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.agentId || !isOpenerRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const forthId = normalizeForthId(
    new URL(req.url).searchParams.get("forthId") || "",
  );
  if (!forthId) {
    return NextResponse.json({ error: "File ID is required." }, { status: 400 });
  }

  const [snapshot, existing] = await Promise.all([
    lookupForthForOpener(forthId),
    existingOpenerLog(forthId),
  ]);

  return NextResponse.json({
    snapshot,
    debtTooLow: matchedDebtTooLow(snapshot),
    existing: existing
      ? {
          agentId: existing.agentId,
          displayName: existing.agent.displayName,
          mine: existing.agentId === session.user.agentId,
        }
      : null,
  });
}
