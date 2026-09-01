import { describe, expect, it } from "vitest";
import { scoreForthUserMatch, sortUsersForForthName, filterUnmatchedForthNames, filterForthMapUsers } from "./unmatched-match";

describe("scoreForthUserMatch", () => {
  it("prefers a last-name hit on an ADP CRM alias", () => {
    const user = {
      displayName: "AJ",
      aliases: ["Valipour, AJ"],
    };
    expect(scoreForthUserMatch("AJ Valipour", user)).toBe(2);
    expect(scoreForthUserMatch("Emerson Gonzalez", user)).toBe(0);
  });
});

describe("sortUsersForForthName", () => {
  it("puts likely ADP matches first", () => {
    const users = [
      { displayName: "Pat Kim", aliases: ["Kim, Pat"] },
      { displayName: "AJ", aliases: ["Valipour, AJ"] },
    ];
    const { likely, rest } = sortUsersForForthName("AJ Valipour", users);
    expect(likely.map((u) => u.displayName)).toEqual(["AJ"]);
    expect(rest.map((u) => u.displayName)).toEqual(["Pat Kim"]);
  });
});

describe("dismissed Forth mapping", () => {
  it("hides dismissed assigned_to names like amir moayeri", () => {
    const dismissed = new Set(["amir moayeri"]);
    const rows = [
      { assignedTo: "amir moayeri", fileCount: 12 },
      { assignedTo: "Emerson Gonzalez", fileCount: 26 },
    ];
    expect(filterUnmatchedForthNames(rows, dismissed).map((r) => r.assignedTo)).toEqual([
      "Emerson Gonzalez",
    ]);
  });

  it("hides dismissed users from the mapping picker", () => {
    const dismissed = new Set(["amir moayeri"]);
    const users = [
      { displayName: "Amir", aliases: ["amir moayeri"] },
      { displayName: "AJ Valipour", aliases: ["AJ Valipour"] },
    ];
    expect(filterForthMapUsers(users, dismissed).map((u) => u.displayName)).toEqual([
      "AJ Valipour",
    ]);
  });
});
