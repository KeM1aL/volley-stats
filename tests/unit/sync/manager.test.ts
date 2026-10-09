import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { MatchSync } from "@/lib/rxdb/sync/match-sync";
import { ReferenceSync } from "@/lib/rxdb/sync/reference-sync";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import {
  AWAY_TEAM_ID,
  FORMAT_ID,
  HOME_TEAM_ID,
  PLAYER_ID,
  USER_ID,
  aScorePoint,
  aSet,
  seedServerMatch,
  seedTeams,
} from "../helpers/fixtures";
import { TestDevice, expectServerEqualsDevice, testUser } from "../helpers/test-device";
import { sleep, waitFor } from "../helpers/wait";

describe("SyncManager", () => {
  let server: FakeSupabaseServer;
  let matchId: string;
  const devices: TestDevice[] = [];

  beforeEach(() => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
  });
  afterEach(async () => {
    await Promise.all(devices.splice(0).map((device) => device.dispose()));
  });

  async function device(options: { deviceId?: string; userName?: string } = {}) {
    const created = await TestDevice.create(server, options);
    devices.push(created);
    return created;
  }

  const serverPoints = () => server.rows("score_points", (row) => row.match_id === matchId && !row._deleted);

  it("keeps every score update of a set, online and offline (root cause 1)", async () => {
    const d = await device();
    await d.signIn();
    expect(await d.openMatch(matchId)).toBe(true);
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 5; n++) await d.recordPoint(matchId, set.id, n);
    d.goOffline();
    for (let n = 6; n <= 10; n++) await d.recordPoint(matchId, set.id, n);
    d.goOnline();
    await d.settle(matchId);
    expect(server.row("sets", set.id)!.home_score).toBe(10);
    await expectServerEqualsDevice(d, matchId);
  });

  it("keeps uploading after the profile is refreshed for the same user (root cause 2)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser({ ...testUser() });
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("restarts nothing when the profile is refreshed for the same user (root cause 2)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    await d.manager.awaitMatchInSync(matchId);
    const cancel = vi.spyOn(MatchSync.prototype, "cancel");
    const start = vi.spyOn(MatchSync.prototype, "start");
    const referenceStart = vi.spyOn(ReferenceSync.prototype, "start");
    const referenceStop = vi.spyOn(ReferenceSync.prototype, "stop");
    try {
      let stoppedTracking = false;
      const sampler = setInterval(() => {
        if (!d.manager.isTracking(matchId)) stoppedTracking = true;
      }, 1);
      try {
        // A new object with the same ids, as every profile refresh produces.
        await d.manager.setUser({ ...testUser(), teamIds: [...testUser().teamIds], clubIds: [...testUser().clubIds] });
        await d.manager.setUser(testUser());
      } finally {
        clearInterval(sampler);
      }
      expect(cancel).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(referenceStart).not.toHaveBeenCalled();
      expect(referenceStop).not.toHaveBeenCalled();
      expect(stoppedTracking).toBe(false);
      expect(d.manager.isTracking(matchId)).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("restarts the reference replications but keeps the match replications when the memberships of the user change", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    await d.manager.awaitMatchInSync(matchId);
    const cancel = vi.spyOn(MatchSync.prototype, "cancel");
    const start = vi.spyOn(MatchSync.prototype, "start");
    const referenceStart = vi.spyOn(ReferenceSync.prototype, "start");
    try {
      let stoppedTracking = false;
      const sampler = setInterval(() => {
        if (!d.manager.isTracking(matchId)) stoppedTracking = true;
      }, 1);
      try {
        await d.manager.setUser({ ...testUser(), teamIds: [HOME_TEAM_ID, AWAY_TEAM_ID] });
      } finally {
        clearInterval(sampler);
      }
      expect(referenceStart).toHaveBeenCalledTimes(1);
      expect(referenceStart.mock.calls[0][0].teamIds).toEqual([HOME_TEAM_ID, AWAY_TEAM_ID]);
      expect(cancel).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(stoppedTracking).toBe(false);
      expect(d.manager.userId).toBe(USER_ID);
      // The kept replications still upload.
      const set = await d.startSet(matchId);
      await d.recordPoint(matchId, set.id, 1);
      await d.settle(matchId);
      await expectServerEqualsDevice(d, matchId);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("uploads data recorded before the app was closed, without reopening the match (root cause 3)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 3; n++) await d.recordPoint(matchId, set.id, n);
    await d.restart();
    d.goOnline();
    await d.signIn(); // the home screen: syncMatch is never called
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("survives repeated connection drops while scoring (root cause 4)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 6; n++) {
      if (n % 2 === 1) d.goOffline();
      else d.goOnline();
      await d.recordPoint(matchId, set.id, n);
      await sleep(30);
    }
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("uploads a match that another tab opened (root cause 6)", async () => {
    const d = await device();
    await d.signIn();
    const otherTab = new TrackedMatches(d.db); // another tab shares the device database
    await otherTab.track(matchId, USER_ID);
    await waitFor(() => d.manager.isTracking(matchId), { message: "the leader tracks the match" });
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("uploads 150 points (3 sets) recorded offline", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    for (let setNumber = 1; setNumber <= 3; setNumber++) {
      const set = await d.startSet(matchId, { set_number: setNumber });
      for (let n = 1; n <= 50; n++) await d.recordPoint(matchId, set.id, n);
    }
    d.goOnline();
    await d.settle(matchId, 60_000);
    expect(serverPoints()).toHaveLength(150);
    await expectServerEqualsDevice(d, matchId);
  }, 90_000);

  it("finishes uploading after the app is closed in the middle of a push", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 30; n++) await d.recordPoint(matchId, set.id, n);
    server.latencyMs = 20;
    d.goOnline();
    await waitFor(() => serverPoints().length >= 3, { message: "upload under way" });
    await d.restart();
    server.latencyMs = 0;
    await d.signIn();
    await d.settle(matchId, 20_000);
    await expectServerEqualsDevice(d, matchId);
    expect(await d.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
  }, 40_000);

  it("keeps the data after sign-out and uploads it when the same user signs back in", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await sleep(300);
    expect(serverPoints()).toHaveLength(0);
    expect(await d.pending.count({ matchId })).toBeGreaterThan(0);
    await d.signIn();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("does not upload another account's data", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await d.signIn(testUser("user-2"));
    await sleep(300);
    expect(serverPoints()).toHaveLength(0);
    expect(await d.pending.count({ matchId, statuses: ["pending"] })).toBeGreaterThan(0);
  });

  it("does not hand another account's unsent match to the account that opens it", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await d.signIn(testUser("user-2"));
    await d.openMatch(matchId);
    await d.manager.claimMatch(matchId).catch(() => undefined);
    expect((await d.manager.tracked.entry(matchId))?.userId).toBe(USER_ID);
    await sleep(300);
    expect(d.manager.isTracking(matchId)).toBe(false);
    expect(serverPoints()).toHaveLength(0);
  });

  it("hands a match to the account that opens it once nothing of it is unsent", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.settle(matchId);
    await d.manager.setUser(null);
    await d.signIn(testUser("user-2"));
    await d.openMatch(matchId);
    expect((await d.manager.tracked.entry(matchId))?.userId).toBe("user-2");
    await waitFor(() => d.manager.isTracking(matchId), { message: "user-2 replicates the match" });
  });

  it("continues after the access token expired during a long offline period", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.recordPoint(matchId, set.id, 2);
    server.failNext("jwt-expired", "jwt-expired", "jwt-expired");
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
    expect(await d.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
  });

  it("continues after requests went out with the anon key (session lost, RLS answers 401)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.recordPoint(matchId, set.id, 2);
    server.failNextWrites("anon-rls", "anon-rls", "anon-rls");
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
    expect(await d.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
  });

  it("names a player deleted on the server and uploads the rest", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    server.hardDelete("team_members", PLAYER_ID);
    d.goOnline();
    await waitFor(async () => (await d.pending.count({ matchId, statuses: ["rejected"] })) === 2, {
      message: "stat and point rejected",
    });
    const rejected = (await d.pending.collection.find({ selector: { status: "rejected" } }).exec()).map((doc) => doc.toJSON());
    expect(rejected.map((entry) => entry.error_code)).toEqual(["reference_missing", "reference_missing"]);
    expect(rejected[0].error_params).toEqual({ table: "team_members" });
    await waitFor(() => server.row("sets", set.id)?.home_score === 1, { message: "set uploaded" });
  });

  it("rejects the rows of a rejected set with a reason, and retry uploads all of them", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    server.denyWrites("sets", () => true);
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await waitFor(async () => (await d.pending.count({ matchId, statuses: ["rejected"] })) === 3, {
      message: "set, stat and point rejected",
      timeoutMs: 15_000,
    });
    const codes = Object.fromEntries(
      (await d.pending.collection.find({ selector: { status: "rejected" } }).exec()).map((doc) => [doc.table_name, doc.error_code])
    );
    expect(codes).toEqual({ sets: "rls", player_stats: "parent_rejected", score_points: "parent_rejected" });
    server.allowWrites("sets");
    await d.manager.retryRejected(matchId);
    await d.settle(matchId, 20_000);
    await expectServerEqualsDevice(d, matchId);
  }, 40_000);

  it("ends undo and redo made offline with the right server state", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    const { point } = await d.recordPoint(matchId, set.id, 1);
    await d.db.score_points.findOne(point.id).remove(); // undo
    await d.db.score_points.insert({ ...point } as any); // redo
    d.goOnline();
    await d.settle(matchId);
    expect(server.row("score_points", point.id)!._deleted).toBe(false);
    await d.db.score_points.findOne(point.id).remove();
    await d.settle(matchId);
    expect(server.row("score_points", point.id)!._deleted).toBe(true);
  });

  it("re-sends a rejected removal when it is retried", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    const set = await d.startSet(matchId);
    const { point } = await d.recordPoint(matchId, set.id, 1);
    await d.settle(matchId);
    server.denyWrites("score_points", (row) => row._deleted === true);
    await d.db.score_points.findOne(point.id).remove(); // undo
    await waitFor(async () => (await d.pending.get("score_points", point.id))?.status === "rejected", {
      message: "removal rejected",
    });
    expect(server.row("score_points", point.id)!._deleted).toBe(false);
    server.allowWrites("score_points");
    expect(await d.manager.retryRejected(matchId)).toBe(1);
    await d.settle(matchId);
    expect(server.row("score_points", point.id)!._deleted).toBe(true);
    expect(await d.pending.count({ matchId })).toBe(0);
  });

  it("never shows a point inserted and undone before its first upload as live on the server", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    const { point } = await d.recordPoint(matchId, set.id, 1);
    await d.db.score_points.findOne(point.id).remove();
    d.goOnline();
    await d.settle(matchId);
    const row = server.row("score_points", point.id);
    expect(row === undefined || row._deleted === true).toBe(true);
  });

  it("upgrade: rescues rows missing on the server without overwriting later corrections", async () => {
    const d = await device();
    // What an older app version left on this device: the match, a set and two points never uploaded.
    const { _deleted, ...matchDoc } = pickSchemaFields(
      server.row("matches", matchId)!,
      d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await d.db.matches.insert(matchDoc as any);
    const set = aSet(matchId, { home_score: 7, updated_at: "2026-01-01T00:00:00.000Z" });
    await d.db.sets.insert(set as any);
    const points = [aScorePoint(matchId, set.id, 1), aScorePoint(matchId, set.id, 2)];
    for (const point of points) await d.db.score_points.insert(point as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
    server.seed("sets", { ...set });
    server.editAsWebsite("sets", set.id, { home_score: 10 });

    await d.signIn();

    await waitFor(() => points.every((point) => !!server.row("score_points", point.id)), { message: "points rescued" });
    await waitFor(async () => (await d.db.sets.findOne(set.id).exec())?.home_score === 10, {
      message: "device takes the correction",
    });
    expect(server.row("sets", set.id)!.home_score).toBe(10);
  });

  it("upgrade: does not lose a match another device already scores", async () => {
    const d = await device();
    const { _deleted, ...matchDoc } = pickSchemaFields(
      server.row("matches", matchId)!,
      d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await d.db.matches.insert(matchDoc as any);
    const set = aSet(matchId);
    await d.db.sets.insert(set as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
    server.seed("sets", { ...set });
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" }); // the tablet upgraded first and claimed

    await d.signIn();

    await waitFor(async () => (await d.manager.tracked.entry(matchId)) !== null, { message: "the match is seeded" });
    await sleep(500); // the seeded rows are pushed once
    expect((await d.manager.tracked.entry(matchId))?.claim).not.toBe("lost");
    expect(d.manager.isTracking(matchId)).toBe(true);
    expect(await d.pending.count({ matchId })).toBe(0);
  });

  async function leaveOldLocalMatch(d: TestDevice, id: string) {
    const now = new Date().toISOString();
    await d.db.matches.insert({
      id,
      date: now,
      home_team_id: HOME_TEAM_ID,
      away_team_id: AWAY_TEAM_ID,
      match_format_id: FORMAT_ID,
      status: "completed",
      home_score: 0,
      away_score: 0,
      created_at: now,
      updated_at: now,
    } as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
  }

  it("upgrade: does not re-create a match deleted on the server", async () => {
    const d = await device();
    const deletedMatchId = "20000000-0000-4000-8000-0000000000dd";
    await leaveOldLocalMatch(d, deletedMatchId);
    await d.signIn();
    await waitFor(async () => !!(await d.db.getLocal("sync-upgrade")), { message: "upgrade done" });
    await sleep(200);
    expect(await d.manager.tracked.entry(deletedMatchId)).toBeNull();
    expect(server.row("matches", deletedMatchId)).toBeUndefined();
  });

  it("upgrade: seeds nothing offline and runs again at the next start", async () => {
    const d = await device();
    await leaveOldLocalMatch(d, matchId);
    d.goOffline();
    await d.signIn();
    expect(await d.manager.tracked.entry(matchId)).toBeNull();
    expect(await d.db.getLocal("sync-upgrade")).toBeNull();
    await d.restart();
    d.goOnline();
    await d.signIn();
    expect(await d.manager.tracked.entry(matchId)).not.toBeNull();
    expect(await d.db.getLocal("sync-upgrade")).not.toBeNull();
  });

  /** What an older app version left on this device: the server's match and set, and a point never uploaded. */
  async function leaveRescuableMatch(d: TestDevice, id: string) {
    const { _deleted, ...matchDoc } = pickSchemaFields(
      server.row("matches", id)!,
      d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await d.db.matches.insert(matchDoc as any);
    const set = aSet(id);
    await d.db.sets.insert(set as any);
    server.seed("sets", { ...set });
    const point = aScorePoint(id, set.id, 1);
    await d.db.score_points.insert(point as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
    return { set, point };
  }

  it("upgrade: shows the rescued rows as unsent until the server confirms them", async () => {
    const d = await device();
    const { point } = await leaveRescuableMatch(d, matchId);
    const counts: number[] = [];
    const subscription = d.pending.count$({ matchId, statuses: ["pending"] }).subscribe((count) => counts.push(count));
    try {
      await d.signIn();
      await waitFor(() => !!server.row("score_points", point.id), { message: "point rescued" });
      await d.settle(matchId);
      expect(Math.max(...counts)).toBe(3); // the match, the set and the point
      expect(await d.pending.count({ matchId })).toBe(0);
    } finally {
      subscription.unsubscribe();
    }
  });

  it("upgrade: keeps an old match while its rescue runs, then forgets it", async () => {
    const d = await device();
    const oldMatchId = seedServerMatch(server, { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });
    await leaveRescuableMatch(d, oldMatchId);
    server.failNextWrites(...Array(1000).fill("network")); // the upgrade's read goes through, the rescue doesn't
    await d.signIn();
    expect(await d.manager.tracked.entry(oldMatchId)).not.toBeNull();
    expect(await d.pending.count({ matchId: oldMatchId, statuses: ["pending"] })).toBe(3);
    await d.restart();
    await d.signIn();
    expect(await d.manager.tracked.entry(oldMatchId)).not.toBeNull(); // still unsent: kept
    server.clearFaults();
    await d.settle(oldMatchId);
    await d.restart();
    await d.signIn();
    expect(await d.manager.tracked.entry(oldMatchId)).toBeNull();
  });

  it("upgrade: seeds nothing without a session (the server would hide every match)", async () => {
    const d = await device();
    await leaveOldLocalMatch(d, matchId);
    d.signedIn = false;
    await d.signIn();
    expect(await d.manager.tracked.entry(matchId)).toBeNull();
    expect(await d.db.getLocal("sync-upgrade")).toBeNull();
    d.signedIn = true;
    await d.restart();
    await d.signIn();
    expect(await d.manager.tracked.entry(matchId)).not.toBeNull();
  });

  it("forgets matches unopened for 14 days once nothing is unsent", async () => {
    const d = await device();
    const tracked = new TrackedMatches(d.db);
    const longAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const otherMatchId = seedServerMatch(server);
    await tracked.track(matchId, USER_ID, longAgo);
    await tracked.track(otherMatchId, USER_ID, longAgo);
    await d.db.sets.insert(aSet(otherMatchId) as any); // unsent: this match must stay tracked
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(matchId)).toBeNull();
    expect(await tracked.entry(otherMatchId)).not.toBeNull();
  });

  it("forgets a match whose last-opened date is unreadable", async () => {
    const d = await device();
    const tracked = new TrackedMatches(d.db);
    await tracked.track(matchId, USER_ID, "not a date");
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(matchId)).toBeNull();
  });

  describe("a lost match nobody takes back", () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    /** A match this device lost: tracked as lost with one superseded change. Offline, so nothing is pruned or checked yet. */
    async function leaveLostMatch(d: TestDevice, id: string, openedAt: string) {
      const tracked = new TrackedMatches(d.db);
      await tracked.track(id, USER_ID, openedAt);
      await tracked.setClaim(id, "lost", null);
      const set = aSet(id);
      await d.db.sets.insert(set as any);
      await d.pending.supersedeMatch(id);
      return { tracked, set };
    }

    it("is kept while it was opened within 14 days (the take-back needs its superseded changes)", async () => {
      const d = await device();
      const { tracked, set } = await leaveLostMatch(d, matchId, daysAgo(10));
      d.goOffline();
      await d.signIn();
      expect(await tracked.entry(matchId)).toMatchObject({ claim: "lost" });
      expect((await d.pending.get("sets", set.id))?.status).toBe("superseded");
    });

    it("is aligned with the server and pruned once unopened for 14 days: the superseded rows never reach the server", async () => {
      const d = await device();
      const { tracked, set } = await leaveLostMatch(d, matchId, daysAgo(15));
      await d.signIn();
      expect(await tracked.entry(matchId)).toBeNull();
      expect(await d.pending.get("sets", set.id)).toBeNull();
      expect(await d.pending.count({ matchId })).toBe(0);
      // The local-only row is gone from the device (a tombstone), and neither it nor a removal was sent.
      expect(await d.db.sets.findOne(set.id).exec()).toBeNull();
      expect(server.row("sets", set.id)).toBeUndefined();
      expect(server.log.filter((entry) => entry.table === "sets" && entry.op !== "select")).toEqual([]);
      await d.restart();
      await d.signIn();
      expect(server.log.filter((entry) => entry.table === "sets" && entry.op !== "select")).toEqual([]);
    });

    it("is replaced by the server's version of a superseded row", async () => {
      const d = await device();
      const onServer = server.seed("sets", aSet(matchId, { home_score: 7 }));
      const tracked = new TrackedMatches(d.db);
      await tracked.track(matchId, USER_ID, daysAgo(15));
      await tracked.setClaim(matchId, "lost", null);
      const { _deleted, ...doc } = pickSchemaFields(onServer, d.db.sets.schema.jsonSchema.properties as Record<string, unknown>);
      await d.db.sets.insert({ ...doc, home_score: 2 } as any);
      await d.pending.supersedeMatch(matchId);
      await d.signIn();
      expect(await tracked.entry(matchId)).toBeNull();
      expect(await d.pending.count({ matchId })).toBe(0);
      expect((await d.db.sets.findOne(onServer.id).exec())?.home_score).toBe(7);
      expect(server.row("sets", onServer.id)!.home_score).toBe(7);
    });

    it("stays tracked, with its superseded changes, while the server can't be reached (retried at the next start)", async () => {
      const d = await device();
      const { tracked, set } = await leaveLostMatch(d, matchId, daysAgo(15));
      d.goOffline();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        await d.signIn();
        expect(await tracked.entry(matchId)).toMatchObject({ claim: "lost" });
        expect((await d.pending.get("sets", set.id))?.status).toBe("superseded");
        expect(await d.db.sets.findOne(set.id).exec()).not.toBeNull();
        d.goOnline();
        await d.restart();
        await d.signIn();
        expect(await tracked.entry(matchId)).toBeNull();
        expect(await d.pending.get("sets", set.id)).toBeNull();
        expect(await d.db.sets.findOne(set.id).exec()).toBeNull();
        expect(server.row("sets", set.id)).toBeUndefined();
      } finally {
        warn.mockRestore();
      }
    });

    it("is kept when something of it is still unsent", async () => {
      const d = await device();
      const { tracked } = await leaveLostMatch(d, matchId, daysAgo(15));
      const unsent = aSet(matchId, { set_number: 2 });
      await d.db.sets.insert(unsent as any); // written after the loss: its entry is pending
      expect((await d.pending.get("sets", unsent.id))?.status).toBe("pending");
      d.goOffline();
      await d.signIn();
      expect(await tracked.entry(matchId)).toMatchObject({ claim: "lost" });
      expect(await d.pending.count({ matchId, statuses: ["superseded"] })).toBe(1);
    });

    it("is not asked about on resume once unopened for 14 days, a recent one still is", async () => {
      const d = await device();
      await d.signIn();
      const oldMatchId = seedServerMatch(server);
      const recentMatchId = seedServerMatch(server);
      await d.manager.tracked.track(oldMatchId, USER_ID, daysAgo(15));
      await d.manager.tracked.setClaim(oldMatchId, "lost", null);
      await d.manager.tracked.track(recentMatchId, USER_ID, daysAgo(2));
      await d.manager.tracked.setClaim(recentMatchId, "lost", null);
      await d.manager.checkClaims();
      const asked = server.log.filter((entry) => entry.table === "rpc:get_match_scorer").flatMap((entry) => entry.ids);
      expect(asked).toContain(recentMatchId);
      expect(asked).not.toContain(oldMatchId);
    });
  });

  it("resolves a match opened before sign-in as not synced when the manager is destroyed", async () => {
    const d = await device();
    const opened = d.openMatch(matchId); // waits up to 5 s for a user
    const start = Date.now();
    await d.manager.destroy();
    expect(await opened).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(await d.manager.tracked.entry(matchId)).toBeNull();
  });

  it("starts nothing for a match being opened when the manager is destroyed", async () => {
    const d = await device();
    await d.signIn();
    const opened = d.manager.syncMatch(matchId, 5000);
    await d.manager.destroy();
    expect(await opened).toBe(false);
    await sleep(100);
    expect(d.manager.isTracking(matchId)).toBe(false);
    await d.manager.setUser(testUser());
    expect(d.manager.userId).toBeNull();
    expect(await d.manager.syncMatch(matchId, 5000)).toBe(false);
    expect(d.manager.isTracking(matchId)).toBe(false);
  });

  it("does not turn a synced match back into syncing (the first pull may finish while it is opened)", async () => {
    const d = await device();
    await d.signIn();
    expect(await d.openMatch(matchId)).toBe(true);
    // Opened again: the status is read just before the first pull's "synced" lands.
    vi.spyOn(d.manager.syncStates, "get").mockResolvedValueOnce(null);
    try {
      expect(await d.manager.syncMatch(matchId, 500)).toBe(true);
      expect((await d.manager.syncStates.get(matchId))?.status).toBe("synced");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("keeps a match tracked while its replications are still being cancelled", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    await d.manager.awaitMatchInSync(matchId);
    const cancel = MatchSync.prototype.cancel;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const cancelling = vi.spyOn(MatchSync.prototype, "cancel").mockImplementation(async function (this: MatchSync) {
      await gate;
      return cancel.call(this);
    });
    try {
      const signedOut = d.manager.setUser(null);
      await waitFor(() => cancelling.mock.calls.length > 0, { message: "the cancellation started" });
      await sleep(50);
      expect(d.manager.isTracking(matchId)).toBe(true);
      release();
      await signedOut;
      expect(d.manager.isTracking(matchId)).toBe(false);
    } finally {
      release();
      vi.restoreAllMocks();
    }
  });

  it("tells whether a match it waits on is replicated", async () => {
    const d = await device();
    await d.signIn();
    expect(await d.manager.awaitMatchInSync(matchId)).toBe(false);
    await d.openMatch(matchId);
    expect(await d.manager.awaitMatchInSync(matchId)).toBe(true);
  });

  it("tracks a match opened before sign-in completes", async () => {
    const d = await device();
    const opened = d.openMatch(matchId); // the live page's effect runs before the provider's setUser
    await d.signIn();
    expect(await opened).toBe(true);
    await waitFor(() => d.manager.isTracking(matchId), { message: "the match is tracked" });
  });

  it("still replicates tracked matches when the upgrade seeding fails", async () => {
    const d = await device();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const getLocal = d.db.getLocal.bind(d.db);
    let failed = false;
    vi.spyOn(d.db, "getLocal").mockImplementation(((id: string) => {
      if (id === "sync-upgrade" && !failed) {
        failed = true;
        return Promise.reject(new Error("storage unavailable"));
      }
      return getLocal(id);
    }) as typeof d.db.getLocal);
    try {
      await new TrackedMatches(d.db).track(matchId, USER_ID);
      await d.signIn();
      expect(failed).toBe(true);
      await waitFor(() => d.manager.isTracking(matchId), { message: "the match is tracked" });
      const set = await d.startSet(matchId);
      await d.recordPoint(matchId, set.id, 1);
      await d.settle(matchId);
      await expectServerEqualsDevice(d, matchId);
      expect(warn).toHaveBeenCalledWith("[sync] upgrade seeding failed:", expect.any(Error));
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("refreshes a synced match on demand (rows pushed by another device since the last pull)", async () => {
    const d = await device();
    await d.signIn();
    expect(await d.openMatch(matchId)).toBe(true);
    await d.manager.awaitMatchInSync(matchId);
    const set = server.seed("sets", aSet(matchId, { set_number: 2 }));
    await sleep(100);
    expect(await d.db.sets.findOne(set.id).exec()).toBeNull(); // no realtime stream: only a pull brings it
    expect(await d.manager.refreshMatch(matchId)).toBe(true);
    expect(await d.db.sets.findOne(set.id).exec()).not.toBeNull();
  });

  it("reports a refresh that can't finish in time", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    await d.startSet(matchId);
    expect(await d.manager.refreshMatch(matchId, 200)).toBe(false);
  });

  it("asks the platform to keep local data", async () => {
    const d = await device();
    await d.signIn();
    await waitFor(() => d.platform.wasPersistenceRequested(), { message: "persistent storage requested" });
  });
});
