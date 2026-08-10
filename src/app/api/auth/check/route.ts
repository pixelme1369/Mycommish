import { NextResponse } from "next/server";

/** Dev-only: confirm the Next.js server can see Auth env (no secret values). */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json({
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
    AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
    AUTH_URL: process.env.AUTH_URL ?? null,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
    googleIdLen: process.env.AUTH_GOOGLE_ID?.length ?? 0,
    googleSecretLen: process.env.AUTH_GOOGLE_SECRET?.length ?? 0,
  });
}
