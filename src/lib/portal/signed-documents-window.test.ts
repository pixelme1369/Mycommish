import { describe, expect, it } from "vitest";
import {
  isSignedDocStillVisible,
  SIGNED_DOC_VISIBLE_MONTHS,
} from "./signed-documents-window";

describe("signed document visibility", () => {
  it(`keeps a signed file visible for ${SIGNED_DOC_VISIBLE_MONTHS} months`, () => {
    const signedAt = new Date("2026-05-01T12:00:00Z");
    expect(isSignedDocStillVisible(signedAt, new Date("2026-08-15T12:00:00Z"))).toBe(
      true,
    );
    expect(isSignedDocStillVisible(signedAt, new Date("2026-09-02T12:00:00Z"))).toBe(
      false,
    );
  });
});
