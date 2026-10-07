import { describe, expect, it } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";

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
