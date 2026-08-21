import { describe, expect, it } from "vitest";
import { formatCommissionLinkSummary } from "./link-commission-format";

describe("formatCommissionLinkSummary", () => {
  it("explains when nothing is linked", () => {
    expect(formatCommissionLinkSummary([])).toMatch(/No commission found/);
    expect(formatCommissionLinkSummary([])).toMatch(/do not need to re-upload/);
  });

  it("lists linked periods", () => {
    const msg = formatCommissionLinkSummary([
      { periodLabel: "2026-07", agentName: "AJ Valipour", netCommission: 1200.5 },
    ]);
    expect(msg).toMatch(/Linked 1 period/);
    expect(msg).toMatch(/2026-07 AJ Valipour/);
    expect(msg).toMatch(/\$1,200\.50/);
    expect(msg).toMatch(/no CRM re-upload/);
  });
});
