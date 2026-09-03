import { describe, expect, it } from "vitest";
import { agentIdentityKey } from "@/lib/commission/calculator";
import { isOpenerManagerRole, isOpenerRole } from "@/lib/roles";

describe("opener role", () => {
  it("recognizes opener and opener manager", () => {
    expect(isOpenerRole("opener")).toBe(true);
    expect(isOpenerRole("opener_manager")).toBe(true);
    expect(isOpenerRole("agent")).toBe(false);
    expect(isOpenerRole(null)).toBe(false);
    expect(isOpenerManagerRole("opener_manager")).toBe(true);
    expect(isOpenerManagerRole("opener")).toBe(false);
  });

  it("keys opener aliases the same way as commission names", () => {
    const keys = new Set([agentIdentityKey("Jane Opener")]);
    expect(keys.has(agentIdentityKey("jane opener"))).toBe(true);
    expect(keys.has(agentIdentityKey("Other Agent"))).toBe(false);
  });
});
