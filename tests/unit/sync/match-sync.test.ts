import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { MatchSync, type MatchSyncDeps } from "@/lib/rxdb/sync/match-sync";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { ReferenceSync } from "@/lib/rxdb/sync/reference-sync";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createTestDb } from "../helpers/test-db";
import { createFakeServer } from "../helpers/server";
import {
  AWAY_TEAM_ID,
  HOME_TEAM_ID,
  PLAYER_ID,
  USER_ID,
  aPlayerStat,
  aScorePoint,
  aSet,
  anEvent,
  seedServerMatch,
  seedTeams,
} from "../helpers/fixtures";
import { sleep, waitFor } from "../helpers/wait";

describe("MatchSync", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;
  let server: FakeSupabaseServer;
  let matchId: string;
  const syncs: MatchSync[] = [];

  beforeEach(async () => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
    ({ db, pending } = await createTestDb());
  });
  afterEach(async () => {
    await Promise.all(syncs.splice(0).map((sync) => sync.cancel()));
    await db.remove();
  });

  function startMatchSync(id: string, overrides: Partial<MatchSyncDeps> = {}) {
    const synced: string[] = [];
    const sync = new MatchSync(id, {
      db,
      client: server.client(),
      pending,
      deviceId: "device-a",
      claim: async () => "ok",
      onSuperseded: async () => {},
      onSynced: async (synchronized) => {
        synced.push(synchronized);
      },
      waitForLeadership: false,
      retryTime: 50,
      ...overrides,
    });
    sync.start();
    syncs.push(sync);
    return { sync, synced };
  }

  it("pulls the match with its rows and reports it synced", async () => {
    const set = server.seed("sets", aSet(matchId));
    const { synced } = startMatchSync(matchId);
    await waitFor(() => synced.includes(matchId), { message: "match synced" });
    expect(await db.matches.findOne(matchId).exec()).not.toBeNull();
    expect(await db.sets.findOne(set.id).exec()).not.toBeNull();
  });

  it("pulls only the rows of its own match", async () => {
    const otherMatchId = seedServerMatch(server);
    const mine = server.seed("sets", aSet(matchId));
    const theirs = server.seed("sets", aSet(otherMatchId));
    const { synced } = startMatchSync(matchId);
    await waitFor(() => synced.includes(matchId), { message: "match synced" });
    expect(await db.sets.findOne(mine.id).exec()).not.toBeNull();
    expect(await db.sets.findOne(theirs.id).exec()).toBeNull();
    expect(await db.matches.findOne(otherMatchId).exec()).toBeNull();
  });

  it("clears a leftover pending entry once the replications are idle and in sync", async () => {
    const leftoverId = aSet(matchId).id;
    await pending.markPending("sets", { id: leftoverId, match_id: matchId, updated_at: new Date().toISOString() } as any);
    // Its write failed: the row never reached the database, and the entry is older than SETTLE_GRACE_MS.
    await pending.collection
      .findOne(`sets:${leftoverId}`)
      .incrementalPatch({ updated_at: new Date(Date.now() - 60_000).toISOString() });
    expect(await pending.count({ matchId })).toBe(1);
    startMatchSync(matchId);
    await waitFor(async () => (await pending.count({ matchId })) === 0, { message: "leftover entry cleared" });
  });

  it("clears pending entries once the rows are uploaded", async () => {
    const { sync } = startMatchSync(matchId);
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(async () => (await pending.count({ matchId })) === 0, { message: "pending cleared" });
    expect(server.row("sets", set.id)).toBeDefined();
    await sync.awaitInSync();
  });

  it("uploads the rows of two matches once each, through their own replications", async () => {
    const otherMatchId = seedServerMatch(server);
    startMatchSync(matchId);
    startMatchSync(otherMatchId);
    const a = aSet(matchId);
    const b = aSet(otherMatchId);
    await db.sets.insert(a as any);
    await db.sets.insert(b as any);
    await waitFor(() => !!server.row("sets", a.id) && !!server.row("sets", b.id), { message: "both sets uploaded" });
    await sleep(200);
    const inserts = (id: string) =>
      server.log.filter((entry) => entry.table === "sets" && entry.op === "insert" && entry.ids.includes(id)).length;
    expect(inserts(a.id)).toBe(1);
    expect(inserts(b.id)).toBe(1);
  });

  it("records a rejected row without blocking the rest", async () => {
    server.denyWrites("events", () => true);
    startMatchSync(matchId);
    const set = aSet(matchId);
    const event = anEvent(matchId, null);
    await db.events.insert(event as any);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    await waitFor(async () => (await pending.get("events", event.id))?.status === "rejected", { message: "event rejected" });
    expect((await pending.get("events", event.id))?.error_code).toBe("rls");
  });

  it("uploads a point recorded together with its set without a foreign-key error", async () => {
    startMatchSync(matchId);
    const set = aSet(matchId);
    const stat = aPlayerStat(matchId, set.id);
    const point = aScorePoint(matchId, set.id, 1, { player_stat_id: stat.id });
    await db.sets.insert(set as any);
    await db.player_stats.insert(stat as any);
    await db.score_points.insert(point as any);
    await waitFor(() => !!server.row("score_points", point.id) && !!server.row("player_stats", stat.id), {
      message: "point and stat uploaded",
    });
    expect(server.responseCodes()).not.toContain("23503");
  });
});

describe("ReferenceSync", () => {
  it("pulls teams and only the members of the user's teams", async () => {
    const server = createFakeServer();
    seedTeams(server);
    server.seed("team_members", {
      id: "30000000-0000-4000-8000-000000000009",
      team_id: AWAY_TEAM_ID,
      name: "Other",
      number: 9,
      role: "player",
    });
    const { db } = await createTestDb();
    const reference = new ReferenceSync({ db, client: server.client(), waitForLeadership: false, retryTime: 50 });
    reference.start({ id: USER_ID, teamIds: [HOME_TEAM_ID], clubIds: [] });
    await waitFor(
      async () => (await db.teams.find().exec()).length === 2 && (await db.team_members.find().exec()).length === 1,
      { message: "reference data pulled" }
    );
    expect((await db.team_members.find().exec())[0].id).toBe(PLAYER_ID);
    await reference.stop();
    await db.remove();
  });
});
