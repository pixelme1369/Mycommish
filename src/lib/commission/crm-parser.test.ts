import { describe, expect, it } from "vitest";
import {
  clientRow,
  crmCsv,
  isMonthlyPayFreq,
  parseCrmAndCalculate,
  repairSplitEnrolledDebt,
  safePaymentThreshold,
} from "./crm-parser";

function parse(rows: Record<string, string>[], opts: Parameters<typeof parseCrmAndCalculate>[2] = {}) {
  return parseCrmAndCalculate(crmCsv(rows), "test.csv", {
    persistSameMonthCancel: true,
    requirePriorPaymentEvidence: false,
    ...opts,
  });
}

function byPeriod(periods: ReturnType<typeof parse>) {
  return Object.fromEntries(periods.filter((p) => p.periodLabel).map((p) => [p.periodLabel!, p]));
}

describe("safePaymentThreshold", () => {
  it("known freqs", () => {
    expect(safePaymentThreshold("Monthly")).toBe(2);
    expect(safePaymentThreshold("biweekly")).toBe(4);
    expect(safePaymentThreshold("Bi-Weekly")).toBe(4);
    expect(safePaymentThreshold("Semi-Monthly")).toBe(4);
    expect(safePaymentThreshold("")).toBe(3);
  });

  it("treats monthly as the 2-payment threshold", () => {
    expect(isMonthlyPayFreq("Monthly")).toBe(true);
    expect(isMonthlyPayFreq("Bi-Weekly")).toBe(false);
  });
});

describe("classification", () => {
  it("groups cleared clients by month", () => {
    const periods = parse([
      clientRow("A1", { cleared: "06/10/26", debt: "20000" }),
      clientRow("A2", { cleared: "06/12/26", debt: "30000" }),
    ]);
    const june = byPeriod(periods)["2026-06"];
    expect(june.results[0].unitsCleared).toBe(2);
    expect(june.results[0].grossCommission).toBe(500);
  });

  it("same_month_cancel does not claw back", () => {
    const periods = parse([
      clientRow("A1", { cleared: "06/10/26" }),
      clientRow("A2", { cleared: "06/05/26", dropped: "06/20/26", name: "Dropped Client" }),
    ]);
    const june = byPeriod(periods)["2026-06"];
    expect(june.results[0].unitsCleared).toBe(1);
    expect(june.results[0].clawbackAmount).toBe(0);
    // 2 enrolled in June, 1 with Dropped Date → 50%
    expect(june.results[0].cancellationRate).toBe(50);
    const dropped = june.clientRows.find((c) => c.crmId === "A2");
    expect(dropped?.isCancelled).toBe(true);
    expect(dropped?.commissionOnClient).toBe(0);
  });

  it("cancel rate uses Enrolled Date month cohort (incl. never-cleared)", () => {
    const periods = parse([
      // 10 enrolled in July; 5 have a drop date → 50%
      clientRow("E1", { enrolled: "07/01/26", cleared: "07/10/26" }),
      clientRow("E2", { enrolled: "07/02/26", cleared: "07/11/26" }),
      clientRow("E3", { enrolled: "07/03/26", cleared: "07/12/26" }),
      clientRow("E4", { enrolled: "07/04/26", cleared: "07/13/26" }),
      clientRow("E5", { enrolled: "07/05/26", cleared: "07/14/26" }),
      clientRow("E6", { enrolled: "07/06/26", cleared: "07/15/26", dropped: "08/01/26", payments: "1" }),
      clientRow("E7", { enrolled: "07/07/26", cleared: "07/16/26", dropped: "08/02/26", payments: "1" }),
      clientRow("E8", { enrolled: "07/08/26", dropped: "07/20/26" }), // never cleared, has drop
      clientRow("E9", { enrolled: "07/09/26", dropped: "08/03/26" }), // never cleared, has drop
      clientRow("E10", { enrolled: "07/10/26", dropped: "09/01/26" }), // never cleared, has drop
      // June enrollment must not affect July rate
      clientRow("J1", { enrolled: "06/01/26", cleared: "07/20/26", dropped: "08/10/26", payments: "1" }),
    ]);
    const july = byPeriod(periods)["2026-07"];
    expect(july.results[0].cancellationRate).toBe(50);
    expect(july.results[0].unitsCleared).toBe(5); // E1–E5; J1 is clawback (dropped Aug)
  });

  it("safe_cancel counts as commissioned unit", () => {
    const periods = parse(
      [
        clientRow("A1", { cleared: "06/10/26", debt: "10000" }),
        clientRow("A2", { cleared: "06/12/26", dropped: "08/03/26", payments: "2", debt: "10000" }),
      ],
      { alreadyClearedCrmIds: new Set(["A1", "A2"]) },
    );
    const june = byPeriod(periods)["2026-06"];
    expect(june.results[0].unitsCleared).toBe(2);
    expect(june.results[0].totalClearedDebt).toBe(20000);
    expect(june.results[0].grossCommission).toBe(200);
    expect(june.results[0].notes).toMatch(/safe cancel/);
    const safe = june.clientRows.find((c) => c.crmId === "A2");
    expect(safe?.unitStatus).toBe("safe_cancel");
    expect(safe?.commissionOnClient).toBe(100);
    expect(byPeriod(periods)["2026-08"]).toBeUndefined();
  });

  it("pending below threshold held", () => {
    const periods = parse([
      clientRow("A1", { cleared: "06/10/26" }),
      clientRow("A2", {
        cleared: "06/12/26",
        status: "Pending Affiliate Cancellation",
        payments: "1",
      }),
    ]);
    const june = byPeriod(periods)["2026-06"];
    expect(june.results[0].unitsCleared).toBe(1);
    expect(june.results[0].pendingUnits).toBe(1);
  });
});

describe("clawback dropped month", () => {
  it("lands in client's dropped period", () => {
    const periods = parse(
      [
        clientRow("A1", { cleared: "06/10/26", debt: "20000" }),
        clientRow("A3", { cleared: "06/11/26", debt: "20000" }),
        clientRow("A2", { cleared: "06/12/26", dropped: "08/03/26", payments: "1", debt: "10000" }),
      ],
      { alreadyClearedCrmIds: new Set(["A1", "A2", "A3"]) },
    );
    const map = byPeriod(periods);
    expect(map["2026-06"].results[0].unitsCleared).toBe(2);
    expect(map["2026-06"].results[0].grossCommission).toBe(400);
    expect(map["2026-06"].results[0].clawbackAmount).toBe(0);
    expect(map["2026-08"].results[0].unitsCleared).toBe(0);
    expect(map["2026-08"].results[0].clawbackAmount).toBe(100);
    expect(map["2026-08"].results[0].netCommission).toBe(0);
  });

  it("skips already charged back", () => {
    const periods = parse(
      [
        clientRow("A1", { cleared: "06/10/26" }),
        clientRow("A2", { cleared: "06/12/26", dropped: "08/03/26", payments: "1" }),
      ],
      {
        alreadyClearedCrmIds: new Set(["A1", "A2"]),
        alreadyChargedBackCrmIds: new Set(["A2"]),
      },
    );
    expect(byPeriod(periods)["2026-08"]).toBeUndefined();
  });

  it("payment evidence guard blocks first-time solo clawback", () => {
    const periods = parse(
      [clientRow("Z1", { cleared: "03/05/26", dropped: "06/23/26", payments: "1", debt: "16866" })],
      { requireClawbackPaymentEvidence: true },
    );
    const totalCb = periods.reduce(
      (s, p) => s + p.results.reduce((a, r) => a + r.clawbackAmount, 0),
      0,
    );
    expect(totalCb).toBe(0);
  });

  it("payment evidence allows when already cleared in DB", () => {
    const periods = parse(
      [clientRow("Z2", { cleared: "03/05/26", dropped: "06/23/26", payments: "1", debt: "16866" })],
      {
        requireClawbackPaymentEvidence: true,
        alreadyClearedCrmIds: new Set(["Z2"]),
      },
    );
    const totalCb = periods.reduce(
      (s, p) => s + p.results.reduce((a, r) => a + r.clawbackAmount, 0),
      0,
    );
    expect(totalCb).toBe(168.66);
  });
});

describe("late activation OFF", () => {
  it("credits own cleared month even with partial history", () => {
    const periods = parse(
      [
        clientRow("A1", { cleared: "05/10/26" }),
        clientRow("B1", { cleared: "06/10/26" }),
      ],
      { alreadyClearedCrmIds: new Set(["B1"]) },
    );
    const map = byPeriod(periods);
    expect(map["2026-05"].results[0].unitsCleared).toBe(1);
    expect(map["2026-06"].results[0].unitsCleared).toBe(1);
    expect(map["2026-05"].clientRows.find((c) => c.crmId === "A1")?.isLateActivation).toBeFalsy();
  });
});

describe("credit score", () => {
  it("<500 counts as unit at $0; 500 is normal pay", () => {
    const rows = [];
    for (let i = 1; i <= 20; i++) {
      rows.push(clientRow(`A${i}`, { cleared: "06/05/26", debt: "5000" }));
    }
    rows.push(clientRow("LC1", { cleared: "06/05/26", debt: "5000", creditScore: "499" }));
    rows.push(clientRow("OK500", { cleared: "06/05/26", debt: "5000", creditScore: "500" }));
    const june = byPeriod(parse(rows))["2026-06"];
    expect(june.results[0].unitsCleared).toBe(22);
    // Low-credit debt excluded; score 500 included
    expect(june.results[0].totalClearedDebt).toBe(105000);
    expect(june.results[0].rawTier).toBe(2);
    expect(june.results[0].tierRate).toBe(0.0125);
    expect(june.results[0].grossCommission).toBe(1312.5);
    const lc = june.clientRows.find((c) => c.crmId === "LC1");
    expect(lc?.isLowCredit).toBe(true);
    expect(lc?.commissionOnClient).toBe(0);
    const ok = june.clientRows.find((c) => c.crmId === "OK500");
    expect(ok?.isLowCredit).toBe(false);
    expect(ok?.commissionOnClient).toBe(62.5);
  });
});

describe("CSV quoting", () => {
  it("keeps thousands comma inside quoted Enrolled Debt (real CRM column order)", () => {
    // Real export ends: ... Payments Made, # NSF, Enrolled Debt, Dropped Date, Pay Freq.
    const csv = [
      "ID,Sales Rep,Full Name,1st Payment Cleared Date,Status,Payments Made,# NSF,Enrolled Debt,Dropped Date,Pay Freq.,Credit Score",
      '1229994355,AJ Valipour,Bobby Poole,2026-07-17,Active,1,0,"$45,296.00",,Monthly,666',
    ].join("\n");
    const periods = parseCrmAndCalculate(csv, "crm.csv", {
      persistSameMonthCancel: true,
      requirePriorPaymentEvidence: false,
    });
    const july = byPeriod(periods)["2026-07"];
    const c = july.results[0]._clearedClients!.find((x) => x.crmId === "1229994355")!;
    expect(c.enrolledDebt).toBe(45296);
    expect(c.droppedDate).toBe("");
    expect(c.payFreq).toBe("Monthly");
    expect(c.commissionOnClient).toBeCloseTo(452.96, 1);
  });

  it("repairs unquoted Enrolled Debt split into Dropped Date", () => {
    const r = repairSplitEnrolledDebt("$2", "664.62");
    expect(r.repaired).toBe(true);
    expect(r.debt).toBeCloseTo(2664.62, 2);
    expect(r.droppedRaw).toBe("");
  });

  it("does not let truncated known debt shrink file debt on clawback", () => {
    const periods = parse(
      [
        clientRow("K1", {
          cleared: "05/10/26",
          dropped: "07/15/26",
          payments: "1",
          debt: "2664.62",
          rep: "Adam Elqaza",
        }),
      ],
      {
        alreadyClearedCrmIds: new Set(["K1"]),
        knownEnrolledDebtByCrmId: { K1: 2 }, // poisoned prior clear
        requireClawbackPaymentEvidence: true,
      },
    );
    const july = byPeriod(periods)["2026-07"];
    const cb = july.results[0]._clawbackClients!.find((c) => c.crmId === "K1")!;
    expect(cb.enrolledDebt).toBeCloseTo(2664.62, 2);
    expect(cb.clawbackAmount).toBeGreaterThan(10);
  });
});

describe("accepted claim salesRep overrides", () => {
  it("rebuckets commission under the locked Sales Rep", () => {
    const periods = parse(
      [
        clientRow("A1", {
          rep: "Peter Godwin",
          cleared: "07/10/26",
          debt: "20000",
        }),
      ],
      { salesRepOverrides: new Map([["A1", "Alex Tambouly"]]) },
    );
    const july = byPeriod(periods)["2026-07"];
    expect(july.results).toHaveLength(1);
    expect(july.results[0].agentName).toBe("Alex Tambouly");
    expect(july.results[0].unitsCleared).toBe(1);
    expect(july.directoryClients?.[0].agentName).toBe("Alex Tambouly");
  });
});

describe("validation", () => {
  it("missing columns", () => {
    const out = parseCrmAndCalculate("Sales Rep,Status\nMaria,Active\n", "bad.csv");
    expect(out[0].errors[0]).toMatch(/Missing required CRM columns/);
  });
});
