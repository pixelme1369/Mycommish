import { describe, expect, it } from "vitest";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { isOpenerRole } from "@/lib/roles";

describe("opener role", () => {
  it("recognizes opener and not agent", () => {
    expect(isOpenerRole("opener")).toBe(true);
    expect(isOpenerRole("agent")).toBe(false);
    expect(isOpenerRole(null)).toBe(false);
  });

  it("keys opener aliases the same way as commission names", () => {
    const keys = new Set([agentIdentityKey("Jane Opener")]);
    expect(keys.has(agentIdentityKey("jane opener"))).toBe(true);
    expect(keys.has(agentIdentityKey("Other Agent"))).toBe(false);
  });
});
