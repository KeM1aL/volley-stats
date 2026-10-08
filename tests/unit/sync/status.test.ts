import { describe, expect, it } from "vitest";
import type { PendingChange } from "@/lib/rxdb/sync/pending-changes";
import { deriveSyncStatus } from "@/lib/rxdb/sync/status";
import type { TrackedMatchMap } from "@/lib/rxdb/sync/tracked-matches";

let counter = 0;
const entry = (overrides: Partial<PendingChange> = {}): PendingChange => ({
  id: `sets:${++counter}`,
  table_name: "sets",
  doc_id: `doc-${counter}`,
  match_id: "m1",
  status: "pending",
  attempts: 0,
  error_code: null,
  error_params: null,
  never_uploaded: false,
  is_insert: true,
  doc_updated_at: "2026-10-07T10:00:00.000Z",
  created_at: "2026-10-07T10:00:00.000Z",
  updated_at: "2026-10-07T10:00:00.000Z",
  ...overrides,
});

const tracked: TrackedMatchMap = {
  m1: { userId: "u1", claim: "held", lastOpenedAt: "2026-10-07T10:00:00.000Z", lostTo: null },
  m2: { userId: "u2", claim: null, lastOpenedAt: "2026-10-07T10:00:00.000Z", lostTo: null },
};

describe("deriveSyncStatus", () => {
  it("is saved when nothing is unsent", () => {
    expect(deriveSyncStatus({ entries: [], tracked, userId: "u1", online: true })).toMatchObject({
      state: "saved",
      pendingCount: 0,
      matches: [],
    });
  });

  it("is uploading online and waiting offline while changes are pending", () => {
    const entries = [entry(), entry()];
    expect(deriveSyncStatus({ entries, tracked, userId: "u1", online: true })).toMatchObject({ state: "uploading", pendingCount: 2 });
    expect(deriveSyncStatus({ entries, tracked, userId: "u1", online: false })).toMatchObject({ state: "waiting", pendingCount: 2 });
  });

  it("is a problem when a change was rejected, and lists each reason once", () => {
    const rejected = { status: "rejected" as const, error_code: "rls" };
    const status = deriveSyncStatus({
      entries: [entry(rejected), entry(rejected), entry()],
      tracked,
      userId: "u1",
      online: true,
    });
    expect(status).toMatchObject({ state: "problem", rejectedCount: 2, pendingCount: 1 });
    expect(status.matches[0].reasons).toEqual([{ code: "rls", params: {} }]);
  });

  it("never turns superseded changes into a problem", () => {
    const status = deriveSyncStatus({
      entries: [entry({ status: "superseded", error_code: "scorer_mismatch" })],
      tracked,
      userId: "u1",
      online: true,
    });
    expect(status).toMatchObject({ state: "saved", supersededCount: 1 });
    expect(status.matches[0].superseded).toBe(1);
  });

  it("flags changes recorded by another account", () => {
    const status = deriveSyncStatus({ entries: [entry({ match_id: "m2" })], tracked, userId: "u1", online: true });
    expect(status).toMatchObject({ state: "other-account", otherAccountCount: 1, pendingCount: 0 });
    expect(status.matches[0].otherAccount).toBe(true);
  });

  it("counts a signed-out device's changes as its own", () => {
    expect(deriveSyncStatus({ entries: [entry({ match_id: "m2" })], tracked, userId: null, online: true })).toMatchObject({
      state: "uploading",
      pendingCount: 1,
    });
  });
});
