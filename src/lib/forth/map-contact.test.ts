import { describe, expect, it } from "vitest";
import {
  formatPacificDateTime,
  mapForthContact,
  parseMoney,
  parsePacificDateOrDateTime,
  parsePacificDateTime,
  toYmd,
} from "./map-contact";

const spreadsheetRow = {
  ID: "88421",
  Agent: "Maria Lopez",
  Status: "Submitted",
  "First Name": "Alex",
  "Last Name": "Rivera",
  SSN: "123-45-6789",
  DOB: "01/02/1990",
  "Submission Date": "8/15/2026",
  "Issued Date": "8/20/2026",
  "Annual Premium": "$48,000.00",
};

describe("mapForthContact", () => {
  it("maps spreadsheet-style headers onto forthId / enrolledAmount / dates", () => {
    const row = mapForthContact(spreadsheetRow);
    expect(row).not.toBeNull();
    expect(row!.forthId).toBe("88421");
    expect(row!.agentName).toBe("Maria Lopez");
    expect(row!.status).toBe("Submitted");
    expect(row!.clientFirstName).toBe("Alex");
    expect(row!.clientLastName).toBe("Rivera");
    expect(row!.submittedDate!.toISOString()).toBe("2026-08-15T07:00:00.000Z");
    expect(row!.enrolledDate!.toISOString()).toBe("2026-08-20T07:00:00.000Z");
    expect(row!.enrolledAmount).toBe(48000);
    expect(JSON.stringify(row)).not.toContain("123-45-6789");
    expect(JSON.stringify(row)).not.toContain("1990");
  });

  it("prefers enrolled_date over issued date", () => {
    const row = mapForthContact({
      id: 9,
      agent: "Pat Kim",
      submitted_at: "2026-07-28T18:00:00.000Z",
      enrolled_date: "2026-08-03",
      issued_date: "2026-08-10",
      annual_premium: 12000,
      custom_fields: [
        { field_name: "Carrier", value: "UHC" },
        { name: "SSN", value: "999-00-1111" },
      ],
    });
    expect(row!.enrolledDate!.toISOString()).toBe("2026-08-03T07:00:00.000Z");
    expect(row!.submittedDate!.toISOString()).toBe("2026-07-28T18:00:00.000Z");
    expect(JSON.stringify(row)).not.toContain("999-00-1111");
  });

  it("maps Forth list API rows onto the Neon column names", () => {
    const row = mapForthContact({
      id: "99101",
      fullname: "Seipel, Amy",
      assigned_to: "Maria Lopez",
      leadTitle: "Waiting For First Payment",
      leadstatus: "399299",
      enrolled_debt: "25000.50",
      submitted_at: "2026-08-15 14:02:00",
      program_start_date: "2026-08-20",
      c772033: "2026-08-16",
      c772034: "2026-08-28",
      created: "2026-08-01 09:00:00",
      stageTitle: "Cordoba Servicing",
      tp_id: "1249394315",
      time_in_status: "180",
      inactive_days: "0",
      campaign_id: "1448205",
      last_credit_pulled_date: "2026-08-31",
      c_source: "0",
      state: "WI",
      c_type: "53379",
    });
    expect(row!.forthId).toBe("99101");
    expect(row!.agentName).toBe("Maria Lopez");
    expect(row!.assignedTo).toBe("Maria Lopez");
    expect(row!.status).toBe("Waiting For First Payment");
    expect(row!.leadStatusId).toBe("399299");
    expect(row!.stageTitle).toBe("Cordoba Servicing");
    expect(row!.clientFirstName).toBe("Amy");
    expect(row!.clientLastName).toBe("Seipel");
    expect(row!.enrolledAmount).toBe(25000.5);
    expect(row!.submittedDate!.toISOString()).toBe("2026-08-15T21:02:00.000Z");
    expect(row!.enrolledDate!.toISOString()).toBe("2026-08-16T07:00:00.000Z");
    expect(row!.droppedDate!.toISOString()).toBe("2026-08-28T07:00:00.000Z");
    expect(row!.programStartDate!.toISOString()).toBe("2026-08-20T07:00:00.000Z");
    expect(row!.forthCreatedAt!.toISOString()).toBe("2026-08-01T16:00:00.000Z");
    expect(row!.tpId).toBe("1249394315");
    expect(row!.timeInStatus).toBe("180");
    expect(row!.inactiveDays).toBe(0);
    expect(row!.campaignId).toBe("1448205");
    expect(row!.state).toBe("WI");
    expect(row!.contactType).toBe("53379");
  });

  it("treats naive Forth timestamps as Pacific (PDT in August, PST in January)", () => {
    const august = parsePacificDateTime("2026-08-15 14:02:00");
    const january = parsePacificDateTime("2026-01-15 14:02:00");
    expect(august!.toISOString()).toBe("2026-08-15T21:02:00.000Z");
    expect(january!.toISOString()).toBe("2026-01-15T22:02:00.000Z");
    expect(formatPacificDateTime(august)).toMatch(/8\/15\/2026,\s*2:02\s*PM\s*PDT/);
    expect(toYmd("2026-08-15 14:02:00")).toBe("2026-08-15");
    expect(parsePacificDateOrDateTime("2026-08-15")!.toISOString()).toBe(
      "2026-08-15T07:00:00.000Z",
    );
  });

  it("uses Cordoba enrolled date (c772033) when enrolled_date is missing", () => {
    const row = mapForthContact({
      id: "12",
      assigned_to: "Pat Kim",
      leadTitle: "Enrolled",
      enrolled_debt: 9000,
      submitted_at: "2026-08-10 09:30:00",
      c772033: "2026-08-12",
    });
    expect(row!.enrolledDate!.toISOString()).toBe("2026-08-12T07:00:00.000Z");
    expect(row!.submittedDate!.toISOString()).toBe("2026-08-10T16:30:00.000Z");
  });

  it("returns null without an id", () => {
    expect(mapForthContact({ Agent: "X" })).toBeNull();
  });
});

describe("toYmd / parseMoney", () => {
  it("keeps date-only strings as calendar days", () => {
    expect(toYmd("2026-08-15")).toBe("2026-08-15");
    expect(toYmd("8/5/2026")).toBe("2026-08-05");
  });

  it("parses premium strings", () => {
    expect(parseMoney("$2,000,000.50")).toBe(2000000.5);
    expect(parseMoney("")).toBe(0);
  });
});
