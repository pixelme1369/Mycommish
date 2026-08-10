import { describe, expect, it } from "vitest";
import {
  parseCommissionHistory,
  parseHistoryRate,
} from "./commission-history-parser";

function historyCsv(rows: string[]) {
  return [
    "Month,ID,Sales Rep,Full Name,Enrolled Debt,To subtract,Payments Made,Units,Status,Rate",
    ...rows,
  ].join("\n");
}

describe("parseHistoryRate", () => {
  it("handles percent string, bare percent number, and fraction", () => {
    expect(parseHistoryRate("1.40%")).toBeCloseTo(0.014, 6);
    expect(parseHistoryRate("1.4")).toBeCloseTo(0.014, 6);
    expect(parseHistoryRate(1.4)).toBeCloseTo(0.014, 6);
    expect(parseHistoryRate(0.014)).toBeCloseTo(0.014, 6);
    expect(parseHistoryRate("")).toBeNull();
    expect(parseHistoryRate(null)).toBeNull();
  });
});

describe("parseCommissionHistory", () => {
  it("builds tier gross and stores paidRate for later clawbacks", async () => {
    // One agent, one paid client at $42,869 with Rate 1.40%
    const csv = historyCsv([
      'March,1181065497,Maria,Katherine,"$42,869.00",,1,1,Active,1.40%',
    ]);
    const parsed = await parseCommissionHistory(Buffer.from(csv), "hist.csv", 2025);
    expect(parsed.errors).toEqual([]);
    expect(parsed.periods).toHaveLength(1);
    expect(parsed.periods[0].periodLabel).toBe("2025-03");
    const r = parsed.periods[0].results[0];
    expect(r.unitsCleared).toBe(1);
    expect(r._clearedClients[0].paidRate).toBeCloseTo(0.014, 6);
    // Clawback using Rate (CRM consumer): 42869 * 0.014 = 600.166 → 600.17
    const cb = Math.round(42869 * 0.014 * 100) / 100;
    expect(cb).toBe(600.17);
  });

  it("takes To subtract as-is and never reads Rate on those rows", async () => {
    const csv = historyCsv([
      'March,1001,Maria,Paid Client,"$10000.00",,1,1,Active,2.00%',
      "March,1001,Maria,Paid Client,,-123.45,0,0,Chargeback,",
    ]);
    const parsed = await parseCommissionHistory(Buffer.from(csv), "hist.csv", 2025);
    const r = parsed.periods[0].results[0];
    expect(r.clawbackAmount).toBe(123.45);
    expect(r._clawbackClients[0].clawbackAmount).toBe(123.45);
    expect(r._clawbackClients[0].enrolledDebt).toBe(10000);
    expect(r.netCommission).toBe(
      Math.max(0, Math.round((r.grossCommission - 123.45) * 100) / 100),
    );
  });

  it("errors on missing columns", async () => {
    const parsed = await parseCommissionHistory(
      Buffer.from("Month,ID\nMarch,1\n"),
      "bad.csv",
      2025,
    );
    expect(parsed.errors[0]).toMatch(/Missing column/);
  });

  it("skips blank Month/ID/Sales Rep", async () => {
    const csv = historyCsv([',,,,"100",,,,,']);
    const parsed = await parseCommissionHistory(Buffer.from(csv), "hist.csv", 2025);
    expect(parsed.errors.some((e) => e.includes("missing Month/ID/Sales Rep"))).toBe(true);
  });
});
