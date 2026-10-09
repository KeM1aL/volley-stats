import { describe, expect, it, vi } from "vitest";
import { addDocEqualityToQuery, pickSchemaFields } from "@/lib/rxdb/sync/helper";

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
