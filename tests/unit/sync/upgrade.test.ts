import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import { runSyncUpgrade } from "@/lib/rxdb/sync/upgrade";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createTestDb } from "../helpers/test-db";
import { createFakeServer } from "../helpers/server";
import { USER_ID, aScorePoint, aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";

describe("runSyncUpgrade", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;
  let server: FakeSupabaseServer;
  let tracked: TrackedMatches;

  beforeEach(async () => {
    server = createFakeServer();
    seedTeams(server);
    ({ db, pending } = await createTestDb());
    tracked = new TrackedMatches(db);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.remove();
  });

  /** What an older app version left on this device: a match with a set and `points` points, no pending entries. */
  async function leaveMatch(points: number) {
    const matchId = seedServerMatch(server);
    const { _deleted, ...matchDoc } = pickSchemaFields(
      server.row("matches", matchId)!,
      db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await db.matches.insert(matchDoc as any);
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    const rows = Array.from({ length: points }, (_, index) => aScorePoint(matchId, set.id, index + 1));
    const result = await db.score_points.bulkInsert(rows as any);
    expect(result.error).toEqual([]);
    await pending.collection.find().remove();
    return { matchId, set, rows };
  }

  it("marks every local row of a seeded match with a bounded number of writes", async () => {
    const { matchId, rows } = await leaveMatch(500);
    const markOne = vi.spyOn(pending, "markPending");
    const insert = vi.spyOn(pending.collection, "insert");
    const bulkInsert = vi.spyOn(pending.collection, "bulkInsert");
    const storageWrites = vi.spyOn(pending.collection.storageInstance, "bulkWrite");

    const started = Date.now();
    expect(await runSyncUpgrade(db, tracked, pending, USER_ID, server.client())).toBe(1);
    const elapsed = Date.now() - started;

    expect(await pending.count({ matchId, statuses: ["pending"] })).toBe(rows.length + 2); // + the match and the set
    expect(markOne).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(bulkInsert.mock.calls.length).toBeLessThanOrEqual(2);
    expect(storageWrites.mock.calls.length).toBeLessThanOrEqual(2);
    expect(elapsed).toBeLessThan(5000);
    expect(await tracked.entry(matchId)).not.toBeNull();
  });

  it("marks the rows of several matches together", async () => {
    const first = await leaveMatch(3);
    const second = await leaveMatch(2);
    const bulkInsert = vi.spyOn(pending.collection, "bulkInsert");
    expect(await runSyncUpgrade(db, tracked, pending, USER_ID, server.client())).toBe(2);
    expect(bulkInsert).toHaveBeenCalledTimes(1);
    expect(await pending.count({ matchId: first.matchId })).toBe(5);
    expect(await pending.count({ matchId: second.matchId })).toBe(4);
  });

  it("leaves an entry that already exists as it is", async () => {
    const { set, rows } = await leaveMatch(2);
    await pending.reject("score_points", rows[0], { kind: "permanent", code: "rls" }, { neverUploaded: true });
    await pending.recordAttempt("sets", set);
    const before = await pending.get("sets", set.id);
    await runSyncUpgrade(db, tracked, pending, USER_ID, server.client());
    expect(await pending.get("score_points", rows[0].id)).toMatchObject({ status: "rejected", error_code: "rls", never_uploaded: true });
    expect(await pending.get("sets", set.id)).toEqual(before);
    expect(await pending.get("score_points", rows[1].id)).toMatchObject({ status: "pending", attempts: 0, is_insert: false });
  });

  it("marks a row with the version it has on the device", async () => {
    const { set } = await leaveMatch(0);
    const stored = (await db.sets.findOne(set.id).exec())!.toJSON();
    await runSyncUpgrade(db, tracked, pending, USER_ID, server.client());
    expect(await pending.get("sets", set.id)).toMatchObject({ doc_updated_at: stored.updated_at, match_id: stored.match_id });
  });
});
