import { describe, expect, it } from "vitest";
import { isoToMicros } from "@/lib/rxdb/sync/timestamps";

describe("isoToMicros", () => {
  it("treats Z and +00:00 as the same instant", () => {
    expect(isoToMicros("2026-10-07T10:00:00.123Z")).toBe(isoToMicros("2026-10-07T10:00:00.123000+00:00"));
  });

  it("keeps the microseconds Postgres returns", () => {
    const a = isoToMicros("2026-10-07T10:00:00.123456+00:00")!;
    const b = isoToMicros("2026-10-07T10:00:00.123457+00:00")!;
    expect(b - a).toBe(1);
  });

  it("applies offsets", () => {
    expect(isoToMicros("2026-10-07T12:00:00+02:00")).toBe(isoToMicros("2026-10-07T10:00:00Z"));
  });

  it("returns null for anything that is not a full ISO timestamp", () => {
    expect(isoToMicros("2026-10-07")).toBeNull();
    expect(isoToMicros("hello")).toBeNull();
    expect(isoToMicros(42)).toBeNull();
    expect(isoToMicros(null)).toBeNull();
  });
});
