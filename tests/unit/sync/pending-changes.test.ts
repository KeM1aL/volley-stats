import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { createTestDb } from "../helpers/test-db";
import { aScorePoint, aSet, HOME_TEAM_ID } from "../helpers/fixtures";

const MATCH = "20000000-0000-4000-8000-000000000001";

describe("pending changes", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;

  beforeEach(async () => {
    ({ db, pending } = await createTestDb());
  });
  afterEach(async () => {
    await db.remove();
  });

  it("marks a row pending when it is written on this device", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    expect(await pending.get("sets", set.id)).toMatchObject({
      status: "pending",
      match_id: MATCH,
      table_name: "sets",
      attempts: 0,
      is_insert: true,
    });
  });

  it("remembers that a row is an unsent insert when it is edited before uploading", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    expect((await pending.get("sets", set.id))?.is_insert).toBe(true);
  });

  it("marks an edit of an uploaded row as an update", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const inserted = (await db.sets.findOne(set.id).exec())!.toJSON() as any;
    await pending.onSent("sets", inserted);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    expect((await pending.get("sets", set.id))?.is_insert).toBe(false);
  });

  it("stops holding children back once an older version of an edited insert is accepted", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const inserted = (await db.sets.findOne(set.id).exec())!.toJSON() as any;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } }); // edited before the insert's sent$
    await pending.onSent("sets", inserted);
    expect(await pending.get("sets", set.id)).toMatchObject({ status: "pending", is_insert: false, never_uploaded: false });
    expect(await pending.parentStatus([{ table: "sets", docId: set.id }])).toEqual({ kind: "none" });
  });

  it("uses the match's own id as match_id for matches rows", async () => {
    const now = new Date().toISOString();
    await db.matches.insert({
      id: MATCH,
      date: now,
      home_team_id: HOME_TEAM_ID,
      away_team_id: HOME_TEAM_ID,
      status: "live",
      created_at: now,
      updated_at: now,
    } as any);
    expect((await pending.get("matches", MATCH))?.match_id).toBe(MATCH);
  });

  it("stamps updated_at on every edit of match data", async () => {
    const set = aSet(MATCH, { updated_at: "2020-01-01T00:00:00.000Z" });
    await db.sets.insert(set as any);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    const doc = await db.sets.findOne(set.id).exec();
    expect(doc!.updated_at! > "2020-01-01T00:00:00.000Z").toBe(true);
  });

  it("keeps updated_at of reference rows that already have one", async () => {
    await db.teams.insert({
      id: HOME_TEAM_ID,
      name: "Home",
      status: "active",
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
    } as any);
    await db.teams.findOne(HOME_TEAM_ID).update({ $set: { name: "Renamed" } });
    expect((await db.teams.findOne(HOME_TEAM_ID).exec())!.updated_at).toBe("2020-01-01T00:00:00.000Z");
    expect(await pending.count()).toBe(0);
  });

  it("marks a removal pending", async () => {
    const point = aScorePoint(MATCH, "set-1", 1);
    await db.score_points.insert(point as any);
    const inserted = (await db.score_points.findOne(point.id).exec())!.toJSON() as any;
    await pending.onSent("score_points", inserted);
    expect(await pending.get("score_points", point.id)).toBeNull();
    await db.score_points.findOne(point.id).remove();
    expect((await pending.get("score_points", point.id))?.status).toBe("pending");
  });

  it("clears an entry only when the uploaded version is at least as new as the marked one", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const marked = (await pending.get("sets", set.id))!;
    await pending.onSent("sets", { id: set.id, match_id: MATCH, updated_at: "2000-01-01T00:00:00.000Z" });
    expect(await pending.get("sets", set.id)).not.toBeNull();
    await pending.onSent("sets", { id: set.id, match_id: MATCH, updated_at: marked.doc_updated_at });
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("keeps a rejection when the row is later reported as sent", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    await pending.onSent("sets", { ...set, updated_at: "2999-01-01T00:00:00.000Z" });
    expect(await pending.get("sets", set.id)).toMatchObject({ status: "rejected", error_code: "rls", never_uploaded: true });
  });

  it("makes a rejected row pending again on a new edit and keeps never_uploaded", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    expect(await pending.get("sets", set.id)).toMatchObject({ status: "pending", error_code: null, never_uploaded: true });
  });

  it("supersedes every unsent entry of a match and ignores later edits", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.supersedeMatch(MATCH);
    await db.sets.findOne(set.id).update({ $set: { home_score: 3 } });
    expect((await pending.get("sets", set.id))?.status).toBe("superseded");
  });

  it("keeps a superseded entry superseded when a push that was in flight reports back", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.recordAttempt("sets", set);
    await pending.supersedeMatch(MATCH);
    expect(await pending.recordAttempt("sets", set)).toBe(1);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    expect(await pending.get("sets", set.id)).toMatchObject({ status: "superseded", error_code: "scorer_mismatch", attempts: 1 });
  });

  const LATER = "2999-01-01T00:00:00.000Z";
  const ageEntry = (table: "sets", id: string, ms: number) =>
    pending.collection.findOne(`${table}:${id}`).incrementalPatch({ updated_at: new Date(Date.now() - ms).toISOString() });

  it("clears pending entries marked before a point in time once their version is written", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.clearSettled(db, MATCH, "sets", "2000-01-01T00:00:00.000Z");
    expect(await pending.get("sets", set.id)).not.toBeNull();
    await pending.clearSettled(db, MATCH, "sets", LATER);
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("keeps a recent entry whose write hasn't landed yet", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    // The hook marked a newer version; the write itself is still on its way.
    await pending.markPending("sets", { ...set, updated_at: new Date(Date.now() + 1000).toISOString() });
    await pending.clearSettled(db, MATCH, "sets", LATER);
    expect(await pending.get("sets", set.id)).not.toBeNull();
  });

  it("clears an entry whose write failed (older than 30 s)", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.markPending("sets", { ...set, updated_at: new Date(Date.now() + 1000).toISOString() });
    await ageEntry("sets", set.id, 31_000);
    await pending.clearSettled(db, MATCH, "sets", LATER);
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("clears the entry of a removal once the removal is written", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await db.sets.findOne(set.id).remove();
    await pending.clearSettled(db, MATCH, "sets", LATER);
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("keeps a recent entry of a row not written at all yet, until 30 s have passed", async () => {
    const set = aSet(MATCH);
    await pending.markPending("sets", set, { insert: true });
    await pending.clearSettled(db, MATCH, "sets", LATER);
    expect(await pending.get("sets", set.id)).not.toBeNull();
    await ageEntry("sets", set.id, 31_000);
    await pending.clearSettled(db, MATCH, "sets", LATER);
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("counts attempts", async () => {
    const set = aSet(MATCH);
    expect(await pending.recordAttempt("sets", set)).toBe(1);
    expect(await pending.recordAttempt("sets", set)).toBe(2);
  });

  it("retryRejected marks rejected rows pending again", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    expect(await pending.retryRejected(db)).toBe(1);
    expect((await pending.get("sets", set.id))?.status).toBe("pending");
  });

  it("retryRejected drops, with a warning, the entry of a row that is gone from this device entirely", async () => {
    const set = aSet(MATCH);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(await pending.retryRejected(db)).toBe(0);
      expect(await pending.get("sets", set.id)).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(`sets ${set.id}`));
    } finally {
      warn.mockRestore();
    }
  });

  it("retryRejected re-queues parents before their children", async () => {
    const set = aSet(MATCH);
    const point = aScorePoint(MATCH, set.id, 1);
    await db.sets.insert(set as any);
    await db.score_points.insert(point as any);
    const queued: string[] = [];
    const subscription = pending.collection.$.subscribe((change) => {
      if (change.documentData.status === "pending") queued.push(change.documentData.table_name);
    });
    try {
      await pending.reject("score_points", point, { kind: "permanent", code: "parent_rejected" }, { neverUploaded: true });
      await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
      queued.length = 0;
      expect(await pending.retryRejected(db)).toBe(2);
      expect(queued).toEqual(["sets", "score_points"]);
    } finally {
      subscription.unsubscribe();
    }
  });

  describe("parentStatus", () => {
    const refMatch = { table: "matches", docId: MATCH } as const;
    const refSet = (id: string) => ({ table: "sets", docId: id }) as const;
    const rls = { kind: "permanent", code: "rls" } as const;

    /** An entry for a row the server already has, with an edit waiting. */
    async function markEdit(table: "matches" | "sets", id: string) {
      await pending.markPending(table, { id, match_id: MATCH }, { insert: false });
    }

    it("does not block on a rejected update of an uploaded parent", async () => {
      const set = aSet(MATCH);
      await markEdit("sets", set.id);
      await pending.reject("sets", set, rls, { neverUploaded: false });
      expect(await pending.get("sets", set.id)).toMatchObject({ status: "rejected", is_insert: false, never_uploaded: false });
      expect(await pending.parentStatus([refSet(set.id)])).toEqual({ kind: "none" });
    });

    it("blocks on a rejected parent that is only known as an unsent insert", async () => {
      const set = aSet(MATCH);
      await db.sets.insert(set as any);
      await pending.reject("sets", set, rls, { neverUploaded: false });
      expect(await pending.get("sets", set.id)).toMatchObject({ status: "rejected", is_insert: true, never_uploaded: false });
      expect(await pending.parentStatus([refSet(set.id)])).toEqual({ kind: "rejected", ref: refSet(set.id) });
    });

    it("blocks on a rejected parent the server never accepted", async () => {
      const set = aSet(MATCH);
      await markEdit("sets", set.id);
      await pending.reject("sets", set, rls, { neverUploaded: true });
      expect(await pending.parentStatus([refSet(set.id)])).toEqual({ kind: "rejected", ref: refSet(set.id) });
    });

    it("blocks on a superseded unsent insert", async () => {
      const set = aSet(MATCH);
      await db.sets.insert(set as any);
      await pending.supersedeMatch(MATCH);
      expect(await pending.parentStatus([refSet(set.id)])).toEqual({ kind: "superseded", ref: refSet(set.id) });
    });

    it("does not block on a superseded update of an uploaded parent", async () => {
      const set = aSet(MATCH);
      await markEdit("sets", set.id);
      await pending.supersedeMatch(MATCH);
      expect((await pending.get("sets", set.id))?.status).toBe("superseded");
      expect(await pending.parentStatus([refSet(set.id)])).toEqual({ kind: "none" });
    });

    it("reports the one parent that blocks when a child has two", async () => {
      const set = aSet(MATCH);
      await markEdit("matches", MATCH);
      await pending.reject("matches", { id: MATCH }, rls, { neverUploaded: false }); // uploaded: no block
      await db.sets.insert(set as any);
      await pending.reject("sets", set, rls, { neverUploaded: true }); // unsent: blocks
      expect(await pending.parentStatus([refMatch, refSet(set.id)])).toEqual({ kind: "rejected", ref: refSet(set.id) });
      expect(await pending.parentStatus([refSet(set.id), refMatch])).toEqual({ kind: "rejected", ref: refSet(set.id) });
      expect(await pending.parentStatus([refMatch])).toEqual({ kind: "none" });
    });
  });

  describe("waitUntilSettled", () => {
    it("resolves true at once when nothing is pending", async () => {
      expect(await pending.waitUntilSettled([{ table: "sets", docId: "nothing" }], 1000)).toBe(true);
    });

    it("resolves true when the pending entry settles in time", async () => {
      const set = aSet(MATCH);
      await db.sets.insert(set as any);
      setTimeout(() => void pending.onSent("sets", { ...set, updated_at: "2999-01-01T00:00:00.000Z" }), 50);
      expect(await pending.waitUntilSettled([{ table: "sets", docId: set.id }], 2000)).toBe(true);
    });

    it("resolves false after the timeout while an entry is still pending", async () => {
      const set = aSet(MATCH);
      await db.sets.insert(set as any);
      const started = Date.now();
      expect(await pending.waitUntilSettled([{ table: "sets", docId: set.id }], 100)).toBe(false);
      expect(Date.now() - started).toBeGreaterThanOrEqual(90);
    });

    it("treats a rejected entry as settled", async () => {
      const set = aSet(MATCH);
      await db.sets.insert(set as any);
      await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
      expect(await pending.waitUntilSettled([{ table: "sets", docId: set.id }], 1000)).toBe(true);
    });
  });

  it("counts entries by match, table and status", async () => {
    await db.sets.insert(aSet(MATCH) as any);
    await db.sets.insert(aSet("20000000-0000-4000-8000-000000000002") as any);
    expect(await pending.count({ matchId: MATCH })).toBe(1);
    expect(await pending.count({ tables: ["sets"] })).toBe(2);
    expect(await pending.count({ statuses: ["rejected"] })).toBe(0);
  });
});
