import { NextResponse } from "next/server";
import JSZip from "jszip";
import { auth } from "@/auth";
import { canViewAllCommissions } from "@/lib/auth-guards";
import {
  buildSignedStatementPdf,
  listFullySignedStatements,
} from "@/lib/statements";

export const dynamic = "force-dynamic";

/** ZIP of fully signed statement PDFs (optional ?period=YYYY-MM). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !canViewAllCommissions(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const periodLabel = url.searchParams.get("period")?.trim() || undefined;

  const rows = await listFullySignedStatements({
    periodLabel,
    limit: 300,
  });
  if (!rows.length) {
    return NextResponse.json(
      { error: periodLabel ? `No signed statements for ${periodLabel}.` : "No signed statements yet." },
      { status: 404 },
    );
  }

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const row of rows) {
    if (!row.periodId || !row.agentPeriodId) continue;
    const built = await buildSignedStatementPdf(row.periodId, row.agentPeriodId);
    if (!built) continue;
    let name = built.filename;
    const n = usedNames.get(name) ?? 0;
    usedNames.set(name, n + 1);
    if (n > 0) {
      name = name.replace(/\.pdf$/i, `_${n + 1}.pdf`);
    }
    zip.file(`${row.periodLabel}/${name}`, built.buffer);
  }

  const zipBuf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = periodLabel
    ? `signed_statements_${periodLabel}.zip`
    : `signed_statements_${stamp}.zip`;

  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
