import { describe, expect, it, vi } from "vitest";
import { addDocEqualityToQuery, pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { matchSchema } from "@/lib/rxdb/schema";

describe("pickSchemaFields", () => {
  it("drops columns the local schema does not define", () => {
    const row = {
      id: "a",
      home_score: 1,
      _deleted: false,
      _modified: "2026-10-07T10:00:00.000001+00:00",
      scorer_device_id: "device-b",
    };
    expect(pickSchemaFields(row, { id: {}, home_score: {}, _deleted: {} })).toEqual({
      id: "a",
      home_score: 1,
      _deleted: false,
    });
  });

  it("keeps _deleted even when the schema omits it", () => {
    expect(pickSchemaFields({ id: "a", _deleted: true }, { id: {} })).toEqual({ id: "a", _deleted: true });
  });
});

describe("pickSchemaFields on a match row", () => {
  it("drops archived_at: a device never pulls it, so its push never resets the archive", () => {
    const row = { id: "m", status: "completed", archived_at: "2026-10-21T10:00:00.000Z", _deleted: false };
    const doc = pickSchemaFields(row, matchSchema.properties as Record<string, unknown>);
    expect(doc).toEqual({ id: "m", status: "completed", _deleted: false });
    expect("archived_at" in doc).toBe(false);
  });
});

describe("addDocEqualityToQuery", () => {
  function recordingQuery() {
    const calls: Array<[string, string, unknown]> = [];
    const query: any = {
      eq: (key: string, value: unknown) => (calls.push(["eq", key, value]), query),
      is: (key: string, value: unknown) => (calls.push(["is", key, value]), query),
    };
    return { query, calls };
  }

  it("skips object and array fields silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { query, calls } = recordingQuery();
      const schema = { properties: { id: {}, home_score: {}, current_lineup: {}, players: {} } } as any;
      const doc = { id: "a", home_score: 2, current_lineup: { p1: "x" }, players: ["x"], _deleted: false } as any;
      addDocEqualityToQuery(schema, "_deleted", "_modified", doc, query);
      expect(calls.map(([, key]) => key)).toEqual(["id", "home_score", "_deleted"]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
