import { describe, expect, it } from "vitest";
import { countFor } from "@/lib/rxdb/keyed-count";

describe("countFor", () => {
  it("returns the initial value until a count was reported", () => {
    expect(countFor(null, "match-1", 0)).toBe(0);
    expect(countFor(null, "events,sets", null)).toBeNull();
  });

  it("returns the count that belongs to the current inputs", () => {
    expect(countFor({ key: "match-1", count: 4 }, "match-1", 0)).toBe(4);
  });

  it("ignores a count computed for other inputs", () => {
    expect(countFor({ key: "match-1", count: 4 }, "match-2", 0)).toBe(0);
    expect(countFor({ key: "events", count: 2 }, "events,sets", null)).toBeNull();
  });
});
