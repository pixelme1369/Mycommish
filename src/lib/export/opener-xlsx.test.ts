import { describe, expect, it } from "vitest";
import {
  createOpenerWorkbook,
  writeOpenerWorkbook,
  type OpenerExportLogRow,
  type OpenerExportSummaryRow,
} from "./opener-xlsx-write";
import {
  OPENER_LOG_HEADERS,
  OPENER_LOG_SHEET,
  OPENER_SUMMARY_HEADERS,
  OPENER_SUMMARY_SHEET,
  formatYmdSlash,
  openerExportFilename,
} from "./opener-xlsx-format";
import { OPENER_PAY_APPROVED, OPENER_PAY_EXCLUDED } from "@/lib/opener/payout";

const SAMPLE = {
  monthLabel: "2026-08",
  logs: [
    {
      transferYmd: "2026-08-03",
      openerName: "Tabitha Jaggers",
      forthId: "1242005397",
      debtLoad: 40921,
      stageTitle: "Cordoba Servicing",
      status: "Active",
      commission: 30,
      payStatus: OPENER_PAY_APPROVED,
      notes: "",
      unmatched: false,
    },
    {
      transferYmd: "2026-08-03",
      openerName: "Tabitha Jaggers",
      forthId: "1242326264",
      debtLoad: 0,
      stageTitle: "Cordoba Cancelled",
      status: "Cancelled",
      commission: 0,
      payStatus: OPENER_PAY_EXCLUDED,
      notes: "",
      unmatched: false,
    },
  ],
  summaries: [
    {
      openerName: "Tabitha Jaggers",
      approvedTransfers: 1,
      commissionTotal: 30,
      upscore: 50,
      excludedCanceled: 1,
      pendingCrmReview: 0,
    },
  ],
} satisfies {
  monthLabel: string;
  logs: OpenerExportLogRow[];
  summaries: OpenerExportSummaryRow[];
};

describe("opener excel format helpers", () => {
  it("formats dates like the ops spreadsheet", () => {
    expect(formatYmdSlash("2026-08-03")).toBe("8/3/2026");
  });

  it("names the download file after the period", () => {
    expect(openerExportFilename("2026-08")).toBe("opener-payout-2026-08.xlsx");
  });
});

describe("writeOpenerWorkbook", () => {
  it("writes transfer log and monthly summary tabs", async () => {
    const built = await writeOpenerWorkbook(SAMPLE);
    expect(built.filename).toBe("opener-payout-2026-08.xlsx");
    expect(built.buffer.length).toBeGreaterThan(0);

    const wb = createOpenerWorkbook(SAMPLE);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      OPENER_LOG_SHEET,
      OPENER_SUMMARY_SHEET,
    ]);

    const log = wb.getWorksheet(OPENER_LOG_SHEET);
    if (!log) throw new Error("missing transfer log sheet");
    expect(log.getCell("A1").value).toBe(OPENER_LOG_HEADERS[0]);
    expect(log.getCell("I1").value).toBe(OPENER_LOG_HEADERS[8]);
    expect(log.getCell("A2").value).toBe("8/3/2026");
    expect(log.getCell("B2").value).toBe("Tabitha Jaggers");
    expect(log.getCell("C2").value).toBe("1242005397");
    expect(log.getCell("H2").value).toBe("Approved");
    expect(log.getCell("H3").value).toBe("Excluded - Canceled");

    const summary = wb.getWorksheet(OPENER_SUMMARY_SHEET);
    if (!summary) throw new Error("missing monthly summary sheet");
    expect(summary.getCell("A6").value).toBe(OPENER_SUMMARY_HEADERS[0]);
    expect(summary.getCell("G6").value).toBe(OPENER_SUMMARY_HEADERS[6]);
    expect(summary.getCell("A7").value).toBe("Tabitha Jaggers");
    expect(summary.getCell("B7").value).toBe(1);
    expect(summary.getCell("C7").value).toBe(30);
    expect(summary.getCell("D7").value).toBe(50);
    expect((summary.getCell("E7").value as { formula?: string })?.formula).toBe(
      "C7+D7",
    );
  });
});
