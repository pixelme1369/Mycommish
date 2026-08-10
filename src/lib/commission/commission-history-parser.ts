/**
 * Historical commission ledger parser (.csv / .xlsx) — NOT a CRM export.
 * Port of agent_portal/commission_core/commission_history_parser.py
 *
 * Rate (optional): stored as paidRate for later CRM clawbacks (debt × rate).
 * To-subtract dollars are taken as-is (never recomputed from Rate).
 */

import { parse as parseCsvSync } from "csv-parse/sync";
import ExcelJS from "exceljs";
import {
  agentIdentityKey,
  buildCanonicalAgentNameMap,
  calculateAgentCommission,
  type AgentCommissionResult,
} from "./calculator";

export const HISTORY_REQUIRED_COLUMNS = new Set([
  "month",
  "id",
  "sales rep",
  "enrolled debt",
  "to subtract",
]);

const MONTH_NUMBERS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export type HistoryClearedClient = {
  crmId: string;
  agentName: string;
  clientName: string;
  status: string;
  paymentsMade: number;
  enrolledDebt: number;
  paidRate: number | null;
};

export type HistoryClawbackClient = {
  crmId: string;
  agentName: string;
  clientName: string;
  status: string;
  paymentsMade: number;
  enrolledDebt: number;
  clawbackAmount: number;
};

export type HistoryAgentResult = AgentCommissionResult & {
  clawbackAmount: number;
  netCommission: number;
  source: "history_import";
  pendingUnits: number;
  pendingDebt: number;
  nsfFlagged: boolean;
  _clearedClients: HistoryClearedClient[];
  _clawbackClients: HistoryClawbackClient[];
};

export type HistoryPeriodOutput = {
  periodLabel: string;
  results: HistoryAgentResult[];
};

export type HistoryParseResult = {
  periods: HistoryPeriodOutput[];
  errors: string[];
};

function cleanId(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.trunc(value));
  }
  const s = String(value).trim();
  if (s.endsWith(".0") && /^\d+\.0$/.test(s)) return s.slice(0, -2);
  return s;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const n = Number.parseFloat(String(value).replace(/\$/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseIntLenient(value: unknown): number {
  const n = parseNumber(value);
  return n != null ? Math.trunc(n) : 0;
}

/** Rate cell → decimal fraction (0.014 for 1.40%). Optional. */
export function parseHistoryRate(value: unknown): number | null {
  if (value == null || value === "") return null;
  let num: number;
  if (typeof value === "number") {
    num = value;
  } else {
    let s = String(value).trim();
    if (!s) return null;
    if (s.endsWith("%")) s = s.slice(0, -1).trim();
    num = Number.parseFloat(s);
    if (!Number.isFinite(num)) return null;
  }
  return num >= 1 ? num / 100 : num;
}

function zeroUnitResult(agentName: string): AgentCommissionResult {
  return {
    agentName,
    unitsCleared: 0,
    totalClearedDebt: 0,
    cancellationRate: 0,
    hourlyDraw: 0,
    rawTier: 0,
    adjustedTier: 0,
    tierRate: 0,
    grossCommission: 0,
    payout: 0,
    payoutType: "draw",
    qualityBonusEligible: false,
    cancellationPenaltyApplied: false,
    notes: "Historical import: clawback only, no units cleared this month",
  };
}

type RawRow = unknown[];

async function readRows(
  fileBytes: Uint8Array | Buffer | ArrayBuffer,
  filename: string,
): Promise<{ cols: Map<string, number>; dataRows: RawRow[] }> {
  const buffer = Buffer.isBuffer(fileBytes)
    ? fileBytes
    : Buffer.from(fileBytes instanceof ArrayBuffer ? new Uint8Array(fileBytes) : fileBytes);
  const lower = (filename || "").toLowerCase();

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const allRows = parseCsvSync(text, {
      relax_column_count: true,
      skip_empty_lines: false,
      bom: true,
    }) as string[][];
    if (!allRows.length) throw new Error("File is empty.");
    const cols = new Map<string, number>();
    allRows[0].forEach((h, i) => {
      const key = String(h ?? "")
        .trim()
        .toLowerCase();
      if (key) cols.set(key, i);
    });
    return { cols, dataRows: allRows.slice(1) };
  }

  if (lower.endsWith(".xlsx")) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Workbook has no sheets.");
    const cols = new Map<string, number>();
    const header = sheet.getRow(1);
    header.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = String(cell.value ?? "")
        .trim()
        .toLowerCase();
      if (key) cols.set(key, colNumber - 1);
    });
    const dataRows: RawRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const v = cell.value;
        if (v && typeof v === "object" && "result" in v) {
          values[colNumber - 1] = (v as { result: unknown }).result;
        } else if (v && typeof v === "object" && "text" in v) {
          values[colNumber - 1] = (v as { text: string }).text;
        } else {
          values[colNumber - 1] = v;
        }
      });
      dataRows.push(values);
    });
    return { cols, dataRows };
  }

  throw new Error("Could not read the file — expected an .xlsx workbook or .csv file.");
}

function cellAt(row: RawRow, cols: Map<string, number>, name: string): unknown {
  const idx = cols.get(name);
  if (idx == null || idx >= row.length) return null;
  return row[idx];
}

function rowIsBlank(row: RawRow): boolean {
  return !row.length || row.every((v) => v == null || (typeof v === "string" && !v.trim()));
}

export async function parseCommissionHistory(
  fileBytes: Uint8Array | Buffer | ArrayBuffer,
  filename: string,
  year: number,
): Promise<HistoryParseResult> {
  let cols: Map<string, number>;
  let dataRows: RawRow[];
  try {
    ({ cols, dataRows } = await readRows(fileBytes, filename));
  } catch (e) {
    return { periods: [], errors: [e instanceof Error ? e.message : String(e)] };
  }

  const missing = [...HISTORY_REQUIRED_COLUMNS].filter((c) => !cols.has(c));
  if (missing.length) {
    return { periods: [], errors: [`Missing column(s): ${missing.sort().join(", ")}`] };
  }

  type Bucket = { cleared: HistoryClearedClient[]; clawback: HistoryClawbackClient[] };
  const buckets = new Map<string, Bucket>();
  const debtById = new Map<string, number>();
  const rowErrors: string[] = [];

  const rawNames = dataRows
    .filter((r) => !rowIsBlank(r))
    .map((r) => String(cellAt(r, cols, "sales rep") || "").trim());
  const canonicalByKey = buildCanonicalAgentNameMap(rawNames);

  const keyOf = (periodLabel: string, agentName: string) => `${periodLabel}|||${agentName}`;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;
    if (rowIsBlank(row)) continue;

    const monthName = String(cellAt(row, cols, "month") || "")
      .trim()
      .toLowerCase();
    const monthNum = MONTH_NUMBERS[monthName];
    const crmId = cleanId(cellAt(row, cols, "id"));
    const agentNameRaw = String(cellAt(row, cols, "sales rep") || "").trim();
    const agentName =
      canonicalByKey.get(agentIdentityKey(agentNameRaw)) || agentNameRaw;

    if (!monthNum || !crmId || !agentName) {
      rowErrors.push(`Row ${rowNum}: missing Month/ID/Sales Rep — skipped`);
      continue;
    }

    const periodLabel = `${year}-${String(monthNum).padStart(2, "0")}`;
    const enrolledDebt = parseNumber(cellAt(row, cols, "enrolled debt"));
    const toSubtract = parseNumber(cellAt(row, cols, "to subtract"));

    const base = {
      crmId,
      agentName,
      clientName: String(cellAt(row, cols, "full name") ?? ""),
      status: String(cellAt(row, cols, "status") ?? ""),
      paymentsMade: parseIntLenient(cellAt(row, cols, "payments made")),
    };

    const bKey = keyOf(periodLabel, agentName);
    if (!buckets.has(bKey)) buckets.set(bKey, { cleared: [], clawback: [] });
    const bucket = buckets.get(bKey)!;

    if (enrolledDebt != null) {
      debtById.set(crmId, enrolledDebt);
      bucket.cleared.push({
        ...base,
        enrolledDebt,
        paidRate: parseHistoryRate(cellAt(row, cols, "rate")),
      });
    } else if (toSubtract != null) {
      bucket.clawback.push({
        ...base,
        clawbackAmount: Math.round(Math.abs(toSubtract) * 100) / 100,
        enrolledDebt: debtById.get(crmId) ?? 0,
      });
    } else {
      rowErrors.push(
        `Row ${rowNum} (${agentName}): neither Enrolled Debt nor To subtract is filled — skipped`,
      );
    }
  }

  const periodMap = new Map<string, HistoryAgentResult[]>();

  for (const [bKey, data] of buckets) {
    const [periodLabel, agentName] = bKey.split("|||");
    const cleared = data.cleared;
    const clawback = data.clawback;

    const unitsCleared = cleared.length;
    const totalClearedDebt = cleared.reduce((s, c) => s + c.enrolledDebt, 0);
    const totalForRate = unitsCleared + clawback.length;
    const cancelRatePct = totalForRate > 0 ? (clawback.length / totalForRate) * 100 : 0;

    const baseResult =
      unitsCleared > 0
        ? calculateAgentCommission({
            agentName,
            unitsCleared,
            totalClearedDebt,
            cancellationRatePct: cancelRatePct,
            hourlyDraw: 0,
          })
        : zeroUnitResult(agentName);

    const totalClawback =
      Math.round(clawback.reduce((s, c) => s + c.clawbackAmount, 0) * 100) / 100;

    const result: HistoryAgentResult = {
      ...baseResult,
      clawbackAmount: totalClawback,
      netCommission: Math.max(
        0,
        Math.round((baseResult.grossCommission - totalClawback) * 100) / 100,
      ),
      source: "history_import",
      pendingUnits: 0,
      pendingDebt: 0,
      nsfFlagged: false,
      _clearedClients: cleared,
      _clawbackClients: clawback,
    };

    const list = periodMap.get(periodLabel) ?? [];
    list.push(result);
    periodMap.set(periodLabel, list);
  }

  return {
    periods: [...periodMap.entries()].map(([periodLabel, results]) => ({
      periodLabel,
      results,
    })),
    errors: rowErrors,
  };
}
