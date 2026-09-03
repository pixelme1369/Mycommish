import { describe, expect, it } from "vitest";
import { openerIdForTransferAgent } from "@/lib/agents/opener-match";
import { agentIdentityKey } from "@/lib/commission/calculator";

describe("openerIdForTransferAgent", () => {
  it("matches Transfer Agent names case-insensitively", () => {
    const byName = new Map([[agentIdentityKey("Saeid Anvar"), "agent-1"]]);
    expect(openerIdForTransferAgent("Saeid Anvar", byName)).toBe("agent-1");
    expect(openerIdForTransferAgent("saeid anvar", byName)).toBe("agent-1");
    expect(openerIdForTransferAgent("Someone Else", byName)).toBeNull();
    expect(openerIdForTransferAgent(null, byName)).toBeNull();
  });
});
