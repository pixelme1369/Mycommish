/**
 * Cordoba payout .xlsx parser (no DB).
 * Port of commission_core/cordoba_parser.py — money math does NOT use
 * Chargebacks file Dropped Date or Marketing Payout Debt.
 */

import ExcelJS from "exceljs";

export type CordobaPaidRow = {
  /** Cordoba file ID — same value as ADP CRM External ID (not CRM ID). */
  crmId: string;
  clientName: string;
  source: "first_pays" | "epf";
};

export type CordobaChargebackRow = {
  /** Cordoba file ID — same value as ADP CRM External ID (not CRM ID). */
  crmId: string;
  clientName: string;
  marketingPayoutDebt: number;
  assignedCompany: string;
  enrolledDate: string | null;
  status: string;
  firstPaymentClearedDate: string | null;
  payFreq: string;
  paymentsMade: number | null;
  marketingPaymentCleared: string | null;
  marketingPaymentChargeback: string | null;
  /** Display-only — never used for clawback placement or $. */
  fileDroppedDate: string | null;
};

export type CordobaParseResult = {
  paidIds: CordobaPaidRow[];
  chargebacks: CordobaChargebackRow[];
  errors: string[];
};

const REQUIRED_SHEETS = new Set(["first pays", "epf"]);

function cleanId(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.trunc(value));
  }
  const s = String(value).trim();
  if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, "");
  return s;
}

function cleanDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    const y = value.getUTCFullYear();
    return `${m}/${d}/${y}`;
  }
  const s = String(value).trim();
  return s || null;
}

function cleanAmount(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  const n = Number.parseFloat(String(value).replace(/\$/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function cleanInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Math.trunc(value);
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function sheetByName(wb: ExcelJS.Workbook, wantedLower: string): ExcelJS.Worksheet | undefined {
  return wb.worksheets.find((s) => s.name.trim().toLowerCase() === wantedLower);
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(1);
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const h = String(cell.value ?? "").trim().toLowerCase();
    if (h) map.set(h, colNumber);
  });
  return map;
}

function cellAt(row: ExcelJS.Row, cols: Map<string, number>, key: string): unknown {
  const idx = cols.get(key);
  if (idx == null) return null;
  const cell = row.getCell(idx);
  const v = cell.value;
  if (v && typeof v === "object" && "text" in v) return (v as { text: string }).text;
  if (v && typeof v === "object" && "result" in v) return (v as { result: unknown }).result;
  return v;
}

function parseChargebacks(wb: ExcelJS.Workbook, errors: string[]): CordobaChargebackRow[] {
  const sheet = sheetByName(wb, "chargebacks");
  if (!sheet) return [];

  const cols = headerMap(sheet);
  if (!cols.has("id")) {
    errors.push("Chargebacks tab is missing an 'ID' column.");
    return [];
  }

  const rows: CordobaChargebackRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const crmId = cleanId(cellAt(row, cols, "id"));
    if (!crmId) return;
    rows.push({
      crmId,
      clientName: String(cellAt(row, cols, "full name") ?? ""),
      marketingPayoutDebt: cleanAmount(cellAt(row, cols, "marketing payout debt")),
      assignedCompany: String(cellAt(row, cols, "assigned company") ?? ""),
      enrolledDate: cleanDate(cellAt(row, cols, "enrolled date")),
      status: String(cellAt(row, cols, "status") ?? ""),
      firstPaymentClearedDate: cleanDate(cellAt(row, cols, "1st payment cleared date")),
      payFreq: String(cellAt(row, cols, "pay freq.") ?? ""),
      paymentsMade: cleanInt(cellAt(row, cols, "payments made")),
      marketingPaymentCleared: cleanDate(cellAt(row, cols, "marketing payment cleared")),
      marketingPaymentChargeback: cleanDate(cellAt(row, cols, "marketing payment chargeback")),
      fileDroppedDate: cleanDate(cellAt(row, cols, "dropped date")),
    });
  });
  return rows;
}

export async function parseCordobaPayout(
  fileBytes: Uint8Array | Buffer | ArrayBuffer,
): Promise<CordobaParseResult> {
  const errors: string[] = [];
  const buffer = Buffer.isBuffer(fileBytes)
    ? fileBytes
    : Buffer.from(fileBytes instanceof ArrayBuffer ? new Uint8Array(fileBytes) : fileBytes);

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return {
      paidIds: [],
      chargebacks: [],
      errors: [
        "Could not read the file — expected an .xlsx workbook with First Pays and EPF tabs.",
      ],
    };
  }

  const sheetNamesLower = new Set(workbook.worksheets.map((s) => s.name.trim().toLowerCase()));
  const missing = [...REQUIRED_SHEETS].filter((s) => !sheetNamesLower.has(s));
  if (missing.length) {
    errors.push(`Missing tab(s) in Cordoba file: ${missing.sort().join(", ")}`);
  }

  const paidIds: CordobaPaidRow[] = [];

  const firstPays = sheetByName(workbook, "first pays");
  if (firstPays) {
    const cols = headerMap(firstPays);
    if (!cols.has("id")) {
      errors.push("First Pays tab is missing an 'ID' column.");
    } else {
      firstPays.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const crmId = cleanId(cellAt(row, cols, "id"));
        if (!crmId) return;
        paidIds.push({
          crmId,
          clientName: String(cellAt(row, cols, "full name") ?? ""),
          source: "first_pays",
        });
      });
    }
  }

  const epf = sheetByName(workbook, "epf");
  if (epf) {
    const cols = headerMap(epf);
    if (!cols.has("contact id")) {
      errors.push("EPF tab is missing a 'Contact ID' column.");
    } else {
      epf.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const crmId = cleanId(cellAt(row, cols, "contact id"));
        if (!crmId) return;
        paidIds.push({
          crmId,
          clientName: String(cellAt(row, cols, "full name") ?? ""),
          source: "epf",
        });
      });
    }
  }

  const chargebacks = parseChargebacks(workbook, errors);
  return { paidIds, chargebacks, errors };
}
