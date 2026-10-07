import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("clears pending entries marked before a point in time", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.clearSettled(MATCH, "sets", "2000-01-01T00:00:00.000Z");
    expect(await pending.get("sets", set.id)).not.toBeNull();
    await pending.clearSettled(MATCH, "sets", "2999-01-01T00:00:00.000Z");
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

  it("counts entries by match, table and status", async () => {
    await db.sets.insert(aSet(MATCH) as any);
    await db.sets.insert(aSet("20000000-0000-4000-8000-000000000002") as any);
    expect(await pending.count({ matchId: MATCH })).toBe(1);
    expect(await pending.count({ tables: ["sets"] })).toBe(2);
    expect(await pending.count({ statuses: ["rejected"] })).toBe(0);
  });
});
