import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseCordobaPayout } from "./cordoba-parser";

async function buildWorkbook(tabs: {
  firstPays?: Array<[string | number, string]>;
  epf?: Array<[string | number, string]>;
  chargebacks?: Array<Record<string, unknown>>;
}) {
  const wb = new ExcelJS.Workbook();
  if (tabs.firstPays) {
    const s = wb.addWorksheet("First Pays");
    s.addRow(["ID", "Full Name"]);
    for (const [id, name] of tabs.firstPays) s.addRow([id, name]);
  }
  if (tabs.epf) {
    const s = wb.addWorksheet("EPF");
    s.addRow(["Contact ID", "Full Name"]);
    for (const [id, name] of tabs.epf) s.addRow([id, name]);
  }
  if (tabs.chargebacks) {
    const s = wb.addWorksheet("Chargebacks");
    s.addRow([
      "ID",
      "Full Name",
      "Marketing Payout Debt",
      "Assigned Company",
      "Dropped Date",
    ]);
    for (const r of tabs.chargebacks) {
      s.addRow([
        r.id,
        r.name,
        r.debt,
        r.company,
        r.dropped,
      ]);
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

describe("parseCordobaPayout", () => {
  it("reads First Pays, EPF, and Chargebacks display columns", async () => {
    const buf = await buildWorkbook({
      firstPays: [["4478112.0", "Ada"], [1001, "Bob"]],
      epf: [["2002", "Cara"]],
      chargebacks: [
        {
          id: "4478112",
          name: "Ada",
          debt: 9999,
          company: "X",
          dropped: "08/01/2026",
        },
      ],
    });
    const parsed = await parseCordobaPayout(buf);
    expect(parsed.errors).toEqual([]);
    expect(parsed.paidIds).toEqual([
      { crmId: "4478112", clientName: "Ada", source: "first_pays" },
      { crmId: "1001", clientName: "Bob", source: "first_pays" },
      { crmId: "2002", clientName: "Cara", source: "epf" },
    ]);
    expect(parsed.chargebacks).toHaveLength(1);
    expect(parsed.chargebacks[0].crmId).toBe("4478112");
    expect(parsed.chargebacks[0].marketingPayoutDebt).toBe(9999);
    expect(parsed.chargebacks[0].fileDroppedDate).toBeTruthy();
  });

  it("errors when First Pays / EPF tabs missing", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Chargebacks").addRow(["ID"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseCordobaPayout(buf);
    expect(parsed.errors.some((e) => e.includes("Missing tab"))).toBe(true);
  });
});
