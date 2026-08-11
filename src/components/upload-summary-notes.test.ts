import { describe, expect, it } from "vitest";
import { groupUploadNotes } from "./upload-summary-notes";

describe("groupUploadNotes", () => {
  it("collapses repeated row warnings", () => {
    const groups = groupUploadNotes([
      "Row 48: missing Sales Rep, skipped",
      "Row 87: missing Sales Rep, skipped",
      "Row 120: missing Sales Rep, skipped",
      "Something unique happened",
    ]);
    expect(groups[0].count).toBe(3);
    expect(groups[0].title.toLowerCase()).toContain("missing sales rep");
    expect(groups[0].rowNumbers).toEqual([48, 87, 120]);
    expect(groups.some((g) => g.title === "Something unique happened")).toBe(true);
  });
});
