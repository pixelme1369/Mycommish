import { describe, expect, it } from "vitest";
import { extractContacts } from "./client";

describe("extractContacts", () => {
  it("reads nested Forth list payloads", () => {
    expect(extractContacts({ contacts: [{ id: 1 }] })).toHaveLength(1);
    expect(extractContacts({ response: { data: [{ id: 2 }, { id: 3 }] } })).toHaveLength(2);
    expect(extractContacts([{ id: 4 }])).toHaveLength(1);
    expect(extractContacts({ ok: true })).toHaveLength(0);
  });
});
