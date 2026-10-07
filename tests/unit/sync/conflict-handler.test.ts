import { describe, expect, it } from "vitest";
import { docsEqual, matchConflictHandler } from "@/lib/rxdb/sync/conflict-handler";

const base = {
  id: "s1",
  home_score: 3,
  current_lineup: { p1: "a", p2: "b" },
  updated_at: "2026-10-07T10:00:00.123Z",
  _deleted: false,
};

describe("docsEqual", () => {
  it("treats Postgres and JavaScript timestamps of the same instant as equal", () => {
    expect(docsEqual(base, { ...base, updated_at: "2026-10-07T10:00:00.123+00:00" })).toBe(true);
    expect(docsEqual(base, { ...base, updated_at: "2026-10-07T10:00:00.123000+00:00" })).toBe(true);
  });

  it("sees a one-microsecond difference", () => {
    expect(
      docsEqual(
        { ...base, updated_at: "2026-10-07T10:00:00.123456+00:00" },
        { ...base, updated_at: "2026-10-07T10:00:00.123457+00:00" }
      )
    ).toBe(false);
  });

  it("compares a timestamptz column with its string copy as instants", () => {
    expect(docsEqual({ date: "2026-10-07T18:30:00+00:00" }, { date: "2026-10-07T18:30:00.000Z" })).toBe(true);
  });

  it("ignores _modified, _meta, _rev and _attachments", () => {
    expect(docsEqual(base, { ...base, _modified: "x", _meta: { lwt: 1 }, _rev: "1-a", _attachments: {} })).toBe(true);
  });

  it("treats a missing field and null as equal", () => {
    expect(docsEqual({ ...base, comment: null }, base)).toBe(true);
  });

  it("ignores key order inside nested objects", () => {
    expect(docsEqual(base, { ...base, current_lineup: { p2: "b", p1: "a" } })).toBe(true);
  });

  it("sees a changed score", () => {
    expect(docsEqual(base, { ...base, home_score: 4 })).toBe(false);
  });
});

describe("matchConflictHandler.resolve", () => {
  const server = { ...base, home_score: 1, updated_at: "2026-10-07T11:00:00.000000+00:00" };

  it("keeps the device's version when the device knew a previous server version", async () => {
    const local = { ...base, home_score: 5 };
    const resolved = await matchConflictHandler.resolve(
      { newDocumentState: local, assumedMasterState: { ...base }, realMasterState: server },
      "test"
    );
    expect(resolved).toEqual(local);
  });

  it("keeps the newer edit when the device has no record of the server version", async () => {
    const newerLocal = { ...base, home_score: 5, updated_at: "2026-10-07T12:00:00.000Z" };
    expect(await matchConflictHandler.resolve({ newDocumentState: newerLocal, realMasterState: server }, "test")).toEqual(newerLocal);
    const olderLocal = { ...base, home_score: 5, updated_at: "2026-10-07T09:00:00.000Z" };
    expect(await matchConflictHandler.resolve({ newDocumentState: olderLocal, realMasterState: server }, "test")).toEqual(server);
  });

  it("keeps the server version on a tie", async () => {
    const local = { ...server, home_score: 9, updated_at: "2026-10-07T11:00:00.000Z" };
    expect(await matchConflictHandler.resolve({ newDocumentState: local, realMasterState: server }, "test")).toEqual(server);
  });
});
