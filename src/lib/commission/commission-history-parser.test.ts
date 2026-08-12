import { describe, expect, it } from "vitest";
import {
  applyCrmCreditScoresToHistoryResults,
  parseCommissionHistory,
  parseHistoryRate,
  type HistoryAgentResult,
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

describe("applyCrmCreditScoresToHistoryResults", () => {
  it("zeros commission debt for CRM credit score <= 500 but keeps the unit", async () => {
    const csv = historyCsv([
      'June,1223852031,Al Valipour,Kandi M. Collins,"$47,367.00",,3,,Active,1.25%',
      'June,999,Al Valipour,Other Client,"$10,000.00",,1,,Active,1.25%',
    ]);
    const parsed = await parseCommissionHistory(Buffer.from(csv), "hist.csv", 2026);
    const before = parsed.periods[0].results[0];
    expect(before.unitsCleared).toBe(2);
    expect(before.totalClearedDebt).toBeCloseTo(57367, 2);

    const { results, lowCreditCount, missingScoreCount } = applyCrmCreditScoresToHistoryResults(
      parsed.periods[0].results,
      {
        "1223852031": 480,
        "999": 620,
      },
    );
    expect(lowCreditCount).toBe(1);
    expect(missingScoreCount).toBe(0);

    const r = results[0] as HistoryAgentResult;
    expect(r.unitsCleared).toBe(2);
    expect(r.totalClearedDebt).toBeCloseTo(10000, 2);
    expect(r._clearedClients.find((c) => c.crmId === "1223852031")?.isLowCredit).toBe(true);
    expect(r._clearedClients.find((c) => c.crmId === "999")?.isLowCredit).toBe(false);
    expect(r.notes).toMatch(/Credit Score <= 500/);
    // Gross uses only the non-low-credit debt
    expect(r.grossCommission).toBeLessThan(before.grossCommission);
  });

  it("counts missing CRM scores so ops can re-import after CRM upload", async () => {
    const csv = historyCsv([
      'June,1223852031,Al Valipour,Kandi,"$47,367.00",,3,,Active,1.25%',
    ]);
    const parsed = await parseCommissionHistory(Buffer.from(csv), "hist.csv", 2026);
    const { results, lowCreditCount, missingScoreCount } = applyCrmCreditScoresToHistoryResults(
      parsed.periods[0].results,
      {},
    );
    expect(lowCreditCount).toBe(0);
    expect(missingScoreCount).toBe(1);
    expect(results[0].totalClearedDebt).toBeCloseTo(47367, 2);
  });

  it("uses sheet Commission on Client as paid amount instead of calculating", async () => {
    const csv = [
      "Month,ID,Sales Rep,Full Name,Enrolled Debt,To subtract,Payments Made,Units,Status,Rate,Commission on Client",
      'June,1223852031,Al Valipour,Kandi,"$47,367.00",,3,,Active,1.25%,0',
      'June,999,Al Valipour,Other,"$10,000.00",,1,,Active,1.25%,125.00',
    ].join("\n");
    const parsed = await parseCommissionHistory(Buffer.from(csv), "hist.csv", 2026);
    expect(parsed.periods[0].results[0]._clearedClients[0].sheetCommissionOnClient).toBe(0);
    expect(parsed.periods[0].results[0]._clearedClients[1].sheetCommissionOnClient).toBe(125);

    const { results, sheetCommissionCount } = applyCrmCreditScoresToHistoryResults(
      parsed.periods[0].results,
      { "1223852031": 480, "999": 700 },
    );
    expect(sheetCommissionCount).toBe(2);
    const r = results[0];
    expect(r._clearedClients.find((c) => c.crmId === "1223852031")?.commissionOnClient).toBe(0);
    expect(r._clearedClients.find((c) => c.crmId === "999")?.commissionOnClient).toBe(125);
    expect(r.grossCommission).toBe(125);
    expect(r.unitsCleared).toBe(2);
  });
});
