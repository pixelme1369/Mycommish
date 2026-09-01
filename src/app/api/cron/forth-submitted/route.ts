import { NextResponse } from "next/server";
import { syncForthContacts } from "@/lib/forth/sync";

export const dynamic = "force-dynamic";
/** Full list is ~1,500 rows and can take ~3 minutes. */
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  const header = req.headers.get("authorization") || "";
  if (secret && header === `Bearer ${secret}`) return true;
  if (secret && new URL(req.url).searchParams.get("secret") === secret) return true;
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("vercel-cron")) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncForthContacts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
