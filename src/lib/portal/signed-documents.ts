import { prisma } from "@/lib/db";
import { AgentDocumentSignStatus, AgentRole, PeriodSource } from "@/generated/prisma/client";
import { canAgentSignStatementForPeriod } from "@/lib/commission/calculator";
import { isSignedDocStillVisible } from "@/lib/portal/signed-documents-window";
import { latestCalculatedPeriods } from "@/lib/portal/queries";

export type PortalDocumentKind = "statement" | "company";
export type PortalDocumentStatus = "pending" | "signed";

export type PortalDocumentItem = {
  id: string;
  kind: PortalDocumentKind;
  title: string;
  status: PortalDocumentStatus;
  signedAt: string | null;
  viewHref: string | null;
  signHref: string | null;
  signatureId: string | null;
  filedRecord?: boolean;
};

const SIGN_ROLES: AgentRole[] = [AgentRole.agent, AgentRole.opener, AgentRole.manager];

export async function listPortalDocuments(opts: {
  agentId: string;
  aliasNames: string[];
  now?: Date;
}): Promise<{ pending: PortalDocumentItem[]; signed: PortalDocumentItem[] }> {
  const now = opts.now ?? new Date();
  const aliases = opts.aliasNames.map((n) => n.trim()).filter(Boolean);

  const [companyRows, windows, signedStatements] = await Promise.all([
    prisma.agentDocumentSignature.findMany({
      where: { agentId: opts.agentId },
      include: { document: { select: { title: true, filedRecord: true } } },
      orderBy: { createdAt: "desc" },
    }),
    latestCalculatedPeriods(),
    aliases.length
      ? prisma.commissionStatement.findMany({
          where: {
            agentSignedAt: { not: null },
            OR: aliases.map((n) => ({
              agentName: { equals: n, mode: "insensitive" as const },
            })),
          },
          include: {
            agentPeriod: { select: { id: true, periodId: true } },
          },
          orderBy: { agentSignedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const pending: PortalDocumentItem[] = [];
  const signed: PortalDocumentItem[] = [];

  for (const row of companyRows) {
    const item: PortalDocumentItem = {
      id: row.id,
      kind: "company",
      title: row.document.title,
      status: row.status === AgentDocumentSignStatus.signed ? "signed" : "pending",
      signedAt: row.signedAt?.toISOString() ?? null,
      viewHref: `/api/portal/documents/${row.id}/file`,
      signHref: null,
      signatureId: row.id,
      filedRecord: row.document.filedRecord,
    };
    if (item.status === "pending") pending.push(item);
    else if (
      row.document.filedRecord ||
      (row.signedAt && isSignedDocStillVisible(row.signedAt, now))
    ) {
      signed.push(item);
    }
  }

  for (const st of signedStatements) {
    if (!st.agentSignedAt || !isSignedDocStillVisible(st.agentSignedAt, now)) continue;
    const periodId = st.agentPeriod?.periodId;
    const agentPeriodId = st.agentPeriod?.id ?? st.agentPeriodId;
    signed.push({
      id: st.id,
      kind: "statement",
      title: `Commission statement · ${st.periodLabel}`,
      status: "signed",
      signedAt: st.agentSignedAt.toISOString(),
      viewHref:
        periodId && agentPeriodId
          ? `/api/portal/periods/${periodId}/agents/${agentPeriodId}/statement?inline=1`
          : null,
      signHref:
        periodId && agentPeriodId
          ? `/portal/period/${periodId}/agent/${agentPeriodId}`
          : null,
      signatureId: null,
    });
  }

  if (aliases.length && windows.length) {
    const periodRows = await prisma.agentPeriod.findMany({
      where: {
        periodId: { in: windows.map((p) => p.id) },
        period: { source: PeriodSource.calculated },
        OR: aliases.map((n) => ({
          agentName: { equals: n, mode: "insensitive" as const },
        })),
      },
      include: { period: { select: { id: true, periodLabel: true } } },
    });
    const statementByAp = new Map(
      (
        await prisma.commissionStatement.findMany({
          where: { agentPeriodId: { in: periodRows.map((r) => r.id) } },
          select: { agentPeriodId: true, agentSignedAt: true },
        })
      ).map((s) => [s.agentPeriodId, s]),
    );
    const seen = new Set<string>();
    for (const row of periodRows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const st = statementByAp.get(row.id);
      if (st?.agentSignedAt) continue;
      if (!canAgentSignStatementForPeriod(row.period.periodLabel)) continue;
      pending.push({
        id: row.id,
        kind: "statement",
        title: `Commission statement · ${row.period.periodLabel}`,
        status: "pending",
        signedAt: null,
        viewHref: `/api/portal/periods/${row.periodId}/agents/${row.id}/statement?inline=1`,
        signHref: `/portal/period/${row.periodId}/agent/${row.id}`,
        signatureId: null,
      });
    }
  }

  pending.sort((a, b) => a.title.localeCompare(b.title));
  signed.sort((a, b) => (b.signedAt || "").localeCompare(a.signedAt || ""));
  return { pending, signed };
}

export async function listDocumentRecipients() {
  return prisma.agent.findMany({
    where: {
      role: { in: SIGN_ROLES },
      suspendedAt: null,
    },
    select: { id: true },
  });
}

export async function listDocumentAgents() {
  const rows = await prisma.agent.findMany({
    where: { role: { not: AgentRole.super_admin } },
    select: { id: true, displayName: true, email: true },
    orderBy: { displayName: "asc" },
  });
  return rows.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    email: a.email,
  }));
}

export async function countSignableAgents(): Promise<number> {
  return prisma.agent.count({
    where: {
      role: { in: SIGN_ROLES },
      suspendedAt: null,
    },
  });
}

export async function listAdminUploadedDocuments() {
  const rows = await prisma.agentDocument.findMany({
    orderBy: { sentAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { displayName: true } },
      signatures: {
        select: {
          status: true,
          signedAt: true,
          agent: { select: { displayName: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
    sentAt: d.sentAt.toISOString(),
    filedRecord: d.filedRecord,
    createdByName: d.createdBy.displayName,
    recipients: d.signatures.map((s) => ({
      displayName: s.agent.displayName,
      email: s.agent.email,
      status: s.status === AgentDocumentSignStatus.signed ? "signed" : "pending",
      signedAt: s.signedAt?.toISOString() ?? null,
    })),
  }));
}
