import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildGustoExports,
  buildGustoWorkbook,
  EMPLOYEE_HEADERS,
  CONTRACTOR_HEADERS,
} from "./export";
import { findEmployeeRoster, findContractorRoster } from "./roster";

describe("gusto roster lookup", () => {
  it("finds employee by CRM name", () => {
    const row = findEmployeeRoster("Neka Bullock");
    expect(row?.gustoEmployeeId).toBe("957970");
    expect(row?.lastName).toBe("Bullock");
    expect(row?.firstName).toBe("Neka");
  });

  it("maps CRM spelling to Gusto legal name", () => {
    const row = findEmployeeRoster("AJ Valipour");
    expect(row?.firstName).toBe("Amirarsalan");
    expect(row?.lastName).toBe("Valipour");
    expect(row?.gustoEmployeeId).toBe("a330a1");
  });

  it("maps Tyler Mason to Siavash Baghalian Zadeh", () => {
    const row = findEmployeeRoster("Tyler Mason");
    expect(row?.firstName).toBe("Siavash");
    expect(row?.lastName).toBe("Baghalian Zadeh");
    expect(row?.gustoEmployeeId).toBe("5393fe");
  });

  it("maps Toha Serwan to Tom Elserwan", () => {
    const row = findEmployeeRoster("Toha Serwan");
    expect(row?.firstName).toBe("Tom");
    expect(row?.lastName).toBe("Elserwan");
    expect(row?.gustoEmployeeId).toBe("7dff0b");
  });

  it("finds contractor by CRM name via company map", () => {
    const row = findContractorRoster("amir moayeri");
    expect(row?.businessName).toBe("Debt Free Consulting LLC");
    expect(row?.ein).toBe("*7505");
  });
});

describe("buildGustoExports", () => {
  it("splits employees and contractors into template CSVs", () => {
    const built = buildGustoExports(
      [
        { agentPeriodId: "1", agentName: "Neka Bullock", netCommission: 10167.95 },
        { agentPeriodId: "2", agentName: "amir moayeri", netCommission: 18470.07 },
        { agentPeriodId: "3", agentName: "Artin Namjoo", netCommission: 15163.95 },
      ],
      "2026-07",
    );

    expect(built.employeeCount).toBe(1);
    expect(built.contractorCount).toBe(2);
    expect(built.employeeCsv!.startsWith(EMPLOYEE_HEADERS.join(","))).toBe(true);
    expect(built.contractorCsv!.startsWith(CONTRACTOR_HEADERS.join(","))).toBe(true);
    expect(built.employeeCsv).toContain("Bullock,Neka,");
    expect(built.employeeCsv).toContain(",10167.95,");
    expect(built.employeeCsv).not.toContain("Debt Free");
    expect(built.employeeCsv).not.toContain("Namjoo");
    expect(built.contractorCsv).toContain("Debt Free Consulting LLC");
    expect(built.contractorCsv).toContain("Aluna Consulting Group LLC");
    // Contractor pay goes in bonus (column after empty fixed_amount), not fixed_amount
    const amirLine = built.contractorCsv!
      .split("\n")
      .find((l) => l.includes("Debt Free Consulting LLC"));
    expect(amirLine).toBeTruthy();
    const cols = amirLine!.split(",");
    expect(cols[CONTRACTOR_HEADERS.indexOf("fixed_amount")]).toBe("");
    expect(cols[CONTRACTOR_HEADERS.indexOf("bonus")]).toBe("18470.07");
  });

  it("exports Gusto legal names on employee sheet when roster matches", () => {
    const built = buildGustoExports(
      [{ agentPeriodId: "1", agentName: "AJ Valipour", netCommission: 100 }],
      "2026-07",
    );
    expect(built.employeeCsv).toContain("Valipour,Amirarsalan,");
    expect(built.employeeCsv).toContain("a330a1");
  });

  it("exports aliased CRM names as Gusto legal names", () => {
    const built = buildGustoExports(
      [
        { agentPeriodId: "1", agentName: "Tyler Mason", netCommission: 10 },
        { agentPeriodId: "2", agentName: "Toha Serwan", netCommission: 20 },
        { agentPeriodId: "3", agentName: "Paul Simms", netCommission: 30 },
      ],
      "2026-07",
    );
    expect(built.employeeCsv).toContain("Baghalian Zadeh,Siavash,");
    expect(built.employeeCsv).toContain("5393fe");
    expect(built.employeeCsv).toContain("Elserwan,Tom,");
    expect(built.employeeCsv).toContain("7dff0b");
    expect(built.employeeCsv).toContain("Sims,Paul,");
    expect(built.employeeCsv).toContain("85260d");
  });

  it("prefers Agent profile Gusto fields over roster", () => {
    const built = buildGustoExports(
      [
        {
          agentPeriodId: "1",
          agentName: "Tyler Mason",
          netCommission: 10,
          gustoFirstName: "Custom",
          gustoLastName: "Name",
          gustoEmployeeId: "abc123",
        },
      ],
      "2026-07",
    );
    expect(built.employeeCsv).toContain("Name,Custom,");
    expect(built.employeeCsv).toContain("abc123");
    expect(built.missingGustoId).toEqual([]);
  });

  it("never puts a contractor on the employee sheet", () => {
    const built = buildGustoExports(
      [
        {
          agentPeriodId: "1",
          agentName: "Peter Godwin",
          netCommission: 50368.63,
          employmentType: "contractor",
          companyName: "Wise Consulting",
        },
      ],
      "2026-07",
    );
    expect(built.employeeCsv).toBeNull();
    expect(built.contractorCount).toBe(1);
    expect(built.contractorCsv).toContain("Godwin,Peter,Wise Consulting,*7310,");
    expect(built.contractorCsv).not.toContain("gusto_employee_id");
    const line = built.contractorCsv!.split("\n").find((l) => l.includes("Godwin"));
    const cols = line!.split(",");
    expect(cols[CONTRACTOR_HEADERS.indexOf("fixed_amount")]).toBe("");
    expect(cols[CONTRACTOR_HEADERS.indexOf("bonus")]).toBe("50368.63");
  });
});

describe("buildGustoWorkbook", () => {
  it("puts agents and contractors on separate Excel tabs", async () => {
    const built = await buildGustoWorkbook(
      [
        { agentPeriodId: "1", agentName: "Neka Bullock", netCommission: 10167.95 },
        { agentPeriodId: "2", agentName: "amir moayeri", netCommission: 18470.07 },
      ],
      "2026-07",
    );

    const wb = new ExcelJS.Workbook();
    // exceljs typings accept Buffer; Uint8Array is fine at runtime
    await wb.xlsx.load(built.buffer as unknown as ArrayBuffer);

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Agents", "Contractors"]);
    expect(wb.getWorksheet("Agents")!.getRow(2).getCell(1).value).toBe("Bullock");
    expect(wb.getWorksheet("Contractors")!.getRow(2).getCell(1).value).toBe("Moayeri");
    expect(wb.getWorksheet("Contractors")!.getRow(2).getCell(2).value).toBe("Amir");
    expect(wb.getWorksheet("Contractors")!.getRow(2).getCell(3).value).toBe(
      "Debt Free Consulting LLC",
    );
  });

  it("highlights missing gusto_employee_id cells in red", async () => {
    const built = await buildGustoWorkbook(
      [{ agentPeriodId: "1", agentName: "Unknown Agent Person", netCommission: 10 }],
      "2026-07",
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(built.buffer as unknown as ArrayBuffer);
    const cell = wb.getWorksheet("Agents")!.getRow(2).getCell(4);
    expect(cell.value == null || cell.value === "").toBe(true);
    const fill = cell.fill as ExcelJS.FillPattern | undefined;
    expect(fill?.type).toBe("pattern");
    expect(fill?.fgColor?.argb).toBe("FFFF0000");
    expect(wb.getWorksheet("Agents")!.getRow(2).getCell(1).value).toBe("Person");
    expect(wb.getWorksheet("Agents")!.getRow(2).getCell(2).value).toBe("Unknown Agent");
  });
});
