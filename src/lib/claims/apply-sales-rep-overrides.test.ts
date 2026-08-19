import { describe, expect, it } from "vitest";
import { applySalesRepOverrides } from "./apply-sales-rep-overrides";

describe("applySalesRepOverrides", () => {
  it("rewrites agentName by externalId or crmId", () => {
    const clients = [
      { crmId: "CRM-1", externalId: "EXT-1", agentName: "Peter Godwin" },
      { crmId: "CRM-2", externalId: null, agentName: "Maria" },
    ];
    const n = applySalesRepOverrides(
      clients,
      new Map([
        ["EXT-1", "Alex Tambouly"],
        ["CRM-2", "Alex Tambouly"],
      ]),
    );
    expect(n).toBe(2);
    expect(clients[0].agentName).toBe("Alex Tambouly");
    expect(clients[1].agentName).toBe("Alex Tambouly");
  });

  it("prefers externalId over crmId when both present", () => {
    const clients = [{ crmId: "CRM-1", externalId: "EXT-1", agentName: "Peter" }];
    applySalesRepOverrides(
      clients,
      new Map([
        ["EXT-1", "Alex"],
        ["CRM-1", "Other"],
      ]),
    );
    expect(clients[0].agentName).toBe("Alex");
  });
});
