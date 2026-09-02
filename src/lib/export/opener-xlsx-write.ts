import ExcelJS from "exceljs";
import {
  formatOpenerPayDate,
  formatOpenerPayStatus,
  formatOpenerPeriodName,
  type OpenerPayStatusName,
} from "@/lib/opener/payout";
import {
  OPENER_LOG_HEADERS,
  OPENER_LOG_SHEET,
  OPENER_SUMMARY_HEADERS,
  OPENER_SUMMARY_SHEET,
  formatYmdSlash,
  openerExportFilename,
} from "@/lib/export/opener-xlsx-format";

const NAVY = "1E4D8C";
const ALT_GREEN = "E2EFDA";
const EXCLUDED_RED = "F8CBAD";
const UPSCORE_YELLOW = "FFF2CC";
const MONEY_FMT = '"$"#,##0;[Red]\\-"$"#,##0';

export type OpenerExportLogRow = {
  transferYmd: string;
  openerName: string;
  forthId: string;
  debtLoad: number;
  stageTitle: string | null;
  status: string | null;
  commission: number;
  payStatus: OpenerPayStatusName;
  notes: string;
  unmatched: boolean;
};

export type OpenerExportSummaryRow = {
  openerName: string;
  approvedTransfers: number;
  commissionTotal: number;
  upscore: number;
  excludedCanceled: number;
  pendingCrmReview: number;
};

function moneyFmt(cell: ExcelJS.Cell) {
  cell.numFmt = MONEY_FMT;
}

function headerFill(ws: ExcelJS.Worksheet, row: number, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(row, c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${NAVY}` },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

export function createOpenerWorkbook(opts: {
  monthLabel: string;
  logs: OpenerExportLogRow[];
  summaries: OpenerExportSummaryRow[];
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "mycommish";
  writeLogSheet(wb, opts.logs);
  writeSummarySheet(wb, opts.monthLabel, opts.summaries);
  return wb;
}

export async function writeOpenerWorkbook(opts: {
  monthLabel: string;
  logs: OpenerExportLogRow[];
  summaries: OpenerExportSummaryRow[];
}): Promise<{ buffer: Buffer; filename: string }> {
  const wb = createOpenerWorkbook(opts);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filename: openerExportFilename(opts.monthLabel) };
}

function writeLogSheet(wb: ExcelJS.Workbook, logs: OpenerExportLogRow[]) {
  const ws = wb.addWorksheet(OPENER_LOG_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.addRow([...OPENER_LOG_HEADERS]);
  headerFill(ws, 1, OPENER_LOG_HEADERS.length);
  ws.getRow(1).height = 22;

  logs.forEach((row, idx) => {
    const excelRow = ws.addRow([
      formatYmdSlash(row.transferYmd),
      row.openerName,
      row.forthId,
      row.unmatched ? null : row.debtLoad,
      row.stageTitle || "",
      row.status || "",
      row.unmatched ? null : row.commission,
      formatOpenerPayStatus(row.payStatus),
      row.notes || "",
    ]);
    const excluded = formatOpenerPayStatus(row.payStatus) === "Excluded - Canceled";
    const fill = excluded ? EXCLUDED_RED : idx % 2 === 1 ? ALT_GREEN : "FFFFFF";
    excelRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${fill}` },
      };
    });
    moneyFmt(excelRow.getCell(4));
    moneyFmt(excelRow.getCell(7));
  });

  ws.columns = [
    { width: 12 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 22 },
    { width: 24 },
    { width: 14 },
    { width: 20 },
    { width: 28 },
  ];
}

function writeSummarySheet(
  wb: ExcelJS.Workbook,
  monthLabel: string,
  summaries: OpenerExportSummaryRow[],
) {
  const ws = wb.addWorksheet(OPENER_SUMMARY_SHEET);
  const monthName = formatOpenerPeriodName(monthLabel);
  const payDate = formatOpenerPayDate(monthLabel);

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "Monthly Commission Payout Summary";
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${NAVY}` },
  };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:G2");
  ws.getCell("A2").value =
    "Only rows marked Approved count toward Commission Total. Check the Pending CRM Review column is 0 for every opener before running payroll.";
  ws.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(2).height = 32;

  ws.getCell("A4").value = "Pay period:";
  ws.getCell("A4").font = { bold: true };
  ws.getCell("B4").value = `${monthName} · payday ${payDate}`;

  const headerRow = 6;
  OPENER_SUMMARY_HEADERS.forEach((h, i) => {
    ws.getCell(headerRow, i + 1).value = h;
  });
  headerFill(ws, headerRow, OPENER_SUMMARY_HEADERS.length);

  const firstData = headerRow + 1;
  summaries.forEach((s, idx) => {
    const r = firstData + idx;
    ws.getCell(r, 1).value = s.openerName;
    ws.getCell(r, 2).value = s.approvedTransfers;
    ws.getCell(r, 3).value = s.commissionTotal;
    moneyFmt(ws.getCell(r, 3));
    ws.getCell(r, 4).value = s.upscore;
    moneyFmt(ws.getCell(r, 4));
    ws.getCell(r, 4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${UPSCORE_YELLOW}` },
    };
    ws.getCell(r, 5).value = { formula: `C${r}+D${r}` };
    moneyFmt(ws.getCell(r, 5));
    ws.getCell(r, 6).value = s.excludedCanceled;
    ws.getCell(r, 7).value = s.pendingCrmReview;
  });

  const lastData = summaries.length ? firstData + summaries.length - 1 : headerRow;
  const totalRow = lastData + 1;
  ws.getCell(totalRow, 1).value = "Grand Total";
  ws.getCell(totalRow, 1).font = { bold: true };
  if (summaries.length) {
    ws.getCell(totalRow, 2).value = { formula: `SUM(B${firstData}:B${lastData})` };
    ws.getCell(totalRow, 3).value = { formula: `SUM(C${firstData}:C${lastData})` };
    moneyFmt(ws.getCell(totalRow, 3));
    ws.getCell(totalRow, 4).value = { formula: `SUM(D${firstData}:D${lastData})` };
    moneyFmt(ws.getCell(totalRow, 4));
    ws.getCell(totalRow, 5).value = { formula: `SUM(E${firstData}:E${lastData})` };
    moneyFmt(ws.getCell(totalRow, 5));
    ws.getCell(totalRow, 6).value = { formula: `SUM(F${firstData}:F${lastData})` };
    ws.getCell(totalRow, 7).value = { formula: `SUM(G${firstData}:G${lastData})` };
  } else {
    for (let c = 2; c <= 7; c++) ws.getCell(totalRow, c).value = 0;
  }

  ws.columns = [
    { width: 24 },
    { width: 20 },
    { width: 18 },
    { width: 32 },
    { width: 16 },
    { width: 20 },
    { width: 22 },
  ];
}
