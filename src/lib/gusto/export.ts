/**
 * Gusto payroll export — employee + contractor templates as Excel tabs
 * (and CSV strings for tests / Gusto upload parity).
 */

import ExcelJS from "exceljs";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { resolveEmployment } from "@/lib/agents/contractors";
import {
  findContractorRoster,
  findEmployeeRoster,
  splitPersonName,
  titleCaseName,
  type ContractorRosterRow,
  type EmployeeRosterRow,
} from "./roster";

export const EMPLOYEE_HEADERS = [
  "last_name",
  "first_name",
  "title",
  "gusto_employee_id",
  "regular_hours",
  "overtime_hours",
  "double_overtime_hours",
  "missed_break_hours",
  "holiday_hours",
  "bonus",
  "commission",
  "paycheck_tips",
  "cash_tips",
  "correction_payment",
  "custom_earning_monthly_commissions",
  "reimbursement",
  "personal_note",
] as const;

export const CONTRACTOR_HEADERS = [
  "last_name",
  "first_name",
  "business_name",
  "ssn/ein",
  "hourly_rate",
  "hours",
  "fixed_amount",
  "bonus",
  "reimbursement",
  "tips",
  "cash_tips",
  "invoice_number",
  "note",
] as const;

export type GustoExportAgent = {
  agentPeriodId: string;
  agentName: string;
  netCommission: number;
  /** When set (from Agent profile), forces contractor vs employee sheet. */
  employmentType?: "employee" | "contractor" | null;
  companyName?: string | null;
};

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function moneyPlain(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function toCsv(headers: readonly string[], rows: Array<Array<string | number>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n") + "\n";
}

function employeeRow(
  agent: GustoExportAgent,
  roster: EmployeeRosterRow | null,
  periodLabel: string,
): Array<string | number> {
  // Always use Gusto timesheet legal names when roster matched — never CRM spelling.
  const last = roster?.lastName || "";
  const first = roster?.firstName || "";
  const title = roster?.title || "Debt Settlement Officer (Primary)";
  const id = roster?.gustoEmployeeId || "";
  const hours = roster?.regularHours ?? "0.0";

  return [
    last,
    first,
    title,
    id,
    hours,
    "0.0",
    "0.0",
    "0.0",
    "0.0",
    "",
    agent.netCommission !== 0 ? moneyPlain(agent.netCommission) : "",
    "",
    "",
    "",
    "",
    "0.0",
    `${periodLabel} commission`,
  ];
}

function contractorRow(
  agent: GustoExportAgent,
  roster: ContractorRosterRow | null,
  companyName: string | null,
  periodLabel: string,
): Array<string | number> {
  const business = (roster?.businessName || companyName || "").trim();
  const ein = roster?.ein || "";
  const hourly = roster?.hourlyRate || "";
  // Person columns: prefer roster legal names if present, else title-cased CRM name.
  const split = splitPersonName(agent.agentName);
  const last = (roster?.lastName || titleCaseName(split.lastName)).trim();
  const first = (roster?.firstName || titleCaseName(split.firstName)).trim();

  return [
    last,
    first,
    business,
    ein,
    hourly,
    "",
    agent.netCommission !== 0 ? moneyPlain(agent.netCommission) : "",
    "",
    "",
    "",
    "",
    "",
    `${periodLabel} commission`,
  ];
}

export type GustoSheetData = {
  employeeRows: Array<Array<string | number>>;
  contractorRows: Array<Array<string | number>>;
  employeeCount: number;
  contractorCount: number;
  missingGustoId: string[];
  missingEin: string[];
};

export type GustoBuildResult = GustoSheetData & {
  employeeCsv: string | null;
  contractorCsv: string | null;
};

/**
 * Contractors always go on the Contractors tab — never the Agents tab.
 */
export function collectGustoSheets(
  agents: GustoExportAgent[],
  periodLabel: string,
): GustoSheetData {
  const employeeRows: Array<Array<string | number>> = [];
  const contractorRows: Array<Array<string | number>> = [];
  const missingGustoId: string[] = [];
  const missingEin: string[] = [];

  const sorted = [...agents].sort((a, b) =>
    a.agentName.localeCompare(b.agentName, undefined, { sensitivity: "base" }),
  );

  for (const agent of sorted) {
    const employment = resolveEmployment(agent.agentName, {
      employmentType: agent.employmentType,
      companyName: agent.companyName,
    });

    if (employment.employmentType === "contractor") {
      const roster = findContractorRoster(agent.agentName, employment.companyName);
      if (!roster?.ein) missingEin.push(agent.agentName);
      contractorRows.push(
        contractorRow(agent, roster, employment.companyName, periodLabel),
      );
      continue;
    }

    const roster = findEmployeeRoster(agent.agentName);
    if (!roster?.gustoEmployeeId) missingGustoId.push(agent.agentName);
    employeeRows.push(employeeRow(agent, roster, periodLabel));
  }

  return {
    employeeRows,
    contractorRows,
    employeeCount: employeeRows.length,
    contractorCount: contractorRows.length,
    missingGustoId,
    missingEin,
  };
}

export function buildGustoExports(
  agents: GustoExportAgent[],
  periodLabel: string,
): GustoBuildResult {
  const sheets = collectGustoSheets(agents, periodLabel);
  return {
    ...sheets,
    employeeCsv: sheets.employeeRows.length
      ? toCsv(EMPLOYEE_HEADERS, sheets.employeeRows)
      : null,
    contractorCsv: sheets.contractorRows.length
      ? toCsv(CONTRACTOR_HEADERS, sheets.contractorRows)
      : null,
  };
}

function fillSheet(
  ws: ExcelJS.Worksheet,
  headers: readonly string[],
  rows: Array<Array<string | number>>,
) {
  ws.addRow([...headers]);
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow(row);
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

/** One workbook: Agents tab + Contractors tab (only non-empty tabs included). */
export async function buildGustoWorkbook(
  agents: GustoExportAgent[],
  periodLabel: string,
): Promise<{
  buffer: Buffer;
  filename: string;
  employeeCount: number;
  contractorCount: number;
  missingGustoId: string[];
  missingEin: string[];
}> {
  const sheets = collectGustoSheets(agents, periodLabel);
  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";
  wb.created = new Date();

  if (sheets.employeeRows.length > 0) {
    const agentsSheet = wb.addWorksheet("Agents", {
      properties: { defaultColWidth: 14 },
    });
    fillSheet(agentsSheet, EMPLOYEE_HEADERS, sheets.employeeRows);
  }

  if (sheets.contractorRows.length > 0) {
    const contractorsSheet = wb.addWorksheet("Contractors", {
      properties: { defaultColWidth: 14 },
    });
    fillSheet(contractorsSheet, CONTRACTOR_HEADERS, sheets.contractorRows);
  }

  // Always include both tabs when mixed selection requested empty side? User asked
  // for two tabs when both selected — we only add sheets that have rows.
  // If only one type, still one tab (correct template).

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const safe = periodLabel.replace(/[^\w\-]+/g, "_");
  const filename = `gusto-export-${safe}.xlsx`;

  return {
    buffer,
    filename,
    employeeCount: sheets.employeeCount,
    contractorCount: sheets.contractorCount,
    missingGustoId: sheets.missingGustoId,
    missingEin: sheets.missingEin,
  };
}

export function gustoFilenames(periodLabel: string) {
  const safe = periodLabel.replace(/[^\w\-]+/g, "_");
  return {
    workbook: `gusto-export-${safe}.xlsx`,
    employee: `gusto-commission-export-${safe}.csv`,
    contractor: `gusto-contractor-export-${safe}.csv`,
  };
}

export { agentIdentityKey };
