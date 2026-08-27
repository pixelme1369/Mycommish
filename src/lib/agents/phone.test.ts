import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, normalizeAgentPhone } from "./phone";

describe("normalizeAgentPhone", () => {
  it("formats 10-digit US numbers", () => {
    expect(normalizeAgentPhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizeAgentPhone("5551234567")).toBe("+15551234567");
  });

  it("keeps leading 1 country code", () => {
    expect(normalizeAgentPhone("1-555-123-4567")).toBe("+15551234567");
  });

  it("returns null for empty", () => {
    expect(normalizeAgentPhone("")).toBeNull();
    expect(normalizeAgentPhone("   ")).toBeNull();
  });

  it("rejects too-short numbers", () => {
    expect(() => normalizeAgentPhone("12345")).toThrow(/valid mobile/i);
  });
});

describe("formatPhoneForDisplay", () => {
  it("pretty-prints E.164 US", () => {
    expect(formatPhoneForDisplay("+15551234567")).toBe("(555) 123-4567");
  });
});
