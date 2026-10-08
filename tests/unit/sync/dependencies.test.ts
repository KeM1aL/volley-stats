import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { createPushGate, parentRefs, type ClaimCheck } from "@/lib/rxdb/sync/dependencies";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { createTestDb } from "../helpers/test-db";
import { aScorePoint, aSet } from "../helpers/fixtures";

const MATCH = "20000000-0000-4000-8000-000000000001";
const ok: ClaimCheck = async () => "ok";

describe("parentRefs", () => {
  it("lists the in-match parents of a point, not its stat (no foreign key there)", () => {
    expect(parentRefs("score_points", { match_id: "m", set_id: "s", player_stat_id: "p" })).toEqual([
      { table: "matches", docId: "m" },
      { table: "sets", docId: "s" },
    ]);
  });

  it("skips parents that are not set", () => {
    expect(parentRefs("events", { match_id: "m", set_id: null })).toEqual([{ table: "matches", docId: "m" }]);
  });
});

describe("push gate", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;

  beforeEach(async () => {
    ({ db, pending } = await createTestDb());
  });
  afterEach(async () => {
    await db.remove();
  });

  it("sends a row whose parents are on the server", async () => {
    const gate = createPushGate({ table: "sets", matchId: MATCH, pending, claim: ok });
    expect(await gate.check(aSet(MATCH) as any)).toEqual({ kind: "send" });
  });

  it("does not wait for a parent whose pending change is only an update", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.onSent("sets", (await db.sets.findOne(set.id).exec())!.toJSON() as any);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok, waitMs: 50 });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "send" });
  });

  it("waits for a parent insert that uploads in the meantime", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok, waitMs: 2000 });
    setTimeout(() => void pending.onSent("sets", { ...set, updated_at: "2999-01-01T00:00:00.000Z" }), 50);
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "send" });
  });

  it("asks for a retry while the parent insert is still pending", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok, waitMs: 50 });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "wait", reason: "parents" });
  });

  it("rejects a row whose parent was rejected before reaching the server", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({
      kind: "reject",
      error: { kind: "permanent", code: "parent_rejected", params: { table: "sets" } },
    });
  });

  it("supersedes a row whose parent was superseded", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.supersedeMatch(MATCH);
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "supersede" });
  });

  it("supersedes every row once the claim is lost", async () => {
    const gate = createPushGate({ table: "sets", matchId: MATCH, pending, claim: async () => "lost" });
    expect(await gate.check(aSet(MATCH) as any)).toEqual({ kind: "supersede" });
  });

  it("waits while an offline claim can't be confirmed", async () => {
    const gate = createPushGate({ table: "sets", matchId: MATCH, pending, claim: async () => "unavailable" });
    expect(await gate.check(aSet(MATCH) as any)).toEqual({ kind: "wait", reason: "claim" });
  });
});
