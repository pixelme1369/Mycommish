"use server";

import { ingestCrmUpload, type SaveCrmSummary } from "@/lib/ingest/crm";
import { ingestCordobaUpload, type SaveCordobaSummary } from "@/lib/ingest/cordoba";
import { ingestHistoryUpload, type SaveHistorySummary } from "@/lib/ingest/history";
import { prisma } from "@/lib/db";
import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";

export type UploadCrmState =
  | { ok: true; summary: SaveCrmSummary }
  | { ok: false; error: string }
  | null;

export type UploadCordobaState =
  | { ok: true; summary: SaveCordobaSummary }
  | { ok: false; error: string }
  | null;

export type UploadHistoryState =
  | { ok: true; summary: SaveHistorySummary }
  | { ok: false; error: string }
  | null;

export async function uploadCrmAction(
  _prev: UploadCrmState,
  formData: FormData,
): Promise<UploadCrmState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a CRM CSV file." };
  }
  const name = file.name || "upload.csv";
  if (!name.toLowerCase().endsWith(".csv")) {
    return { ok: false, error: "File must be a .csv CRM export." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > 40 * 1024 * 1024) {
    return { ok: false, error: "File is larger than 40MB." };
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const summary = await ingestCrmUpload(buf, name);
    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Upload failed: ${message}` };
  }
}

export async function uploadCordobaAction(
  _prev: UploadCordobaState,
  formData: FormData,
): Promise<UploadCordobaState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a Cordoba .xlsx file." };
  }
  const name = file.name || "cordoba.xlsx";
  if (!name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "File must be a .xlsx Cordoba payout export." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > 40 * 1024 * 1024) {
    return { ok: false, error: "File is larger than 40MB." };
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const summary = await ingestCordobaUpload(buf, name);
    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Upload failed: ${message}` };
  }
}

export async function uploadHistoryAction(
  _prev: UploadHistoryState,
  formData: FormData,
): Promise<UploadHistoryState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a history .csv or .xlsx file." };
  }
  const name = file.name || "history.csv";
  const lower = name.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
    return { ok: false, error: "File must be .csv or .xlsx." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > 40 * 1024 * 1024) {
    return { ok: false, error: "File is larger than 40MB." };
  }

  const yearRaw = String(formData.get("year") || "").trim();
  const year = Number.parseInt(yearRaw, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, error: "Enter a valid calendar year (e.g. 2025)." };
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const summary = await ingestHistoryUpload(buf, name, year);
    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Upload failed: ${message}` };
  }
}

export async function listCalculatedPeriods() {
  return prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated },
    orderBy: [{ periodLabel: "desc" }, { uploadedAt: "desc" }],
    include: {
      _count: { select: { agentPeriods: true } },
    },
  });
}

export async function listHistoryPeriods() {
  return prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.history },
    orderBy: [{ periodLabel: "desc" }, { uploadedAt: "desc" }],
    include: {
      _count: { select: { agentPeriods: true } },
    },
  });
}

export async function listRecentUploads() {
  return prisma.uploadBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function deleteCalculatedPeriodAction(periodId: string) {
  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) return { ok: false as const, error: "Period not found." };

  await deletePeriodsByIds([periodId]);
  return { ok: true as const, periodLabel: period.periodLabel };
}

export async function deleteHistoryPeriodAction(periodId: string) {
  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.history },
  });
  if (!period) return { ok: false as const, error: "History period not found." };

  await deletePeriodsByIds([periodId]);
  return { ok: true as const, periodLabel: period.periodLabel };
}

async function deletePeriodsByIds(periodIds: string[]) {
  if (!periodIds.length) return;
  await prisma.ledgerEntry.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.clientEvent.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.agentPeriod.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.commissionPeriod.deleteMany({ where: { id: { in: periodIds } } });
}

/** Delete every calculated (CRM) period. */
export async function deleteAllCalculatedPeriodsAction() {
  const periods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.calculated },
    select: { id: true, periodLabel: true },
  });
  await deletePeriodsByIds(periods.map((p) => p.id));
  return {
    ok: true as const,
    deletedCount: periods.length,
    periodLabels: periods.map((p) => p.periodLabel),
  };
}

/** Delete every history period. */
export async function deleteAllHistoryPeriodsAction() {
  const periods = await prisma.commissionPeriod.findMany({
    where: { source: PeriodSource.history },
    select: { id: true, periodLabel: true },
  });
  await deletePeriodsByIds(periods.map((p) => p.id));
  return {
    ok: true as const,
    deletedCount: periods.length,
    periodLabels: periods.map((p) => p.periodLabel),
  };
}

/** Delete all periods from one upload filename (CRM or history). */
export async function deletePeriodsByFilenameAction(
  filename: string,
  source: "calculated" | "history",
) {
  const name = filename.trim();
  if (!name) return { ok: false as const, error: "Missing filename." };

  const periodSource =
    source === "history" ? PeriodSource.history : PeriodSource.calculated;
  const periods = await prisma.commissionPeriod.findMany({
    where: { source: periodSource, filename: name },
    select: { id: true, periodLabel: true },
  });
  if (!periods.length) {
    return { ok: false as const, error: `No ${source} periods found for "${name}".` };
  }

  await deletePeriodsByIds(periods.map((p) => p.id));
  return {
    ok: true as const,
    deletedCount: periods.length,
    periodLabels: periods.map((p) => p.periodLabel),
    filename: name,
  };
}

/** Manually lock a calculated period before payday. Clawbacks still allowed. */
export async function closeCalculatedPeriodAction(periodId: string) {
  const period = await prisma.commissionPeriod.findFirst({
    where: { id: periodId, source: PeriodSource.calculated },
  });
  if (!period) return { ok: false as const, error: "Period not found." };
  if (period.status === PeriodStatus.closed) {
    return { ok: false as const, error: "Period is already closed." };
  }

  await prisma.commissionPeriod.update({
    where: { id: periodId },
    data: { status: PeriodStatus.closed, closedAt: new Date() },
  });
  return { ok: true as const, periodLabel: period.periodLabel };
}

export async function getUploadBatch(batchId: string) {
  return prisma.uploadBatch.findUnique({
    where: { id: batchId },
    include: {
      uploadedBy: { select: { displayName: true, email: true } },
      _count: { select: { clientEvents: true, ledgerEntries: true } },
    },
  });
}
