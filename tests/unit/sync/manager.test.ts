import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import { PLAYER_ID, USER_ID, aScorePoint, aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";
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

  it("asks the platform to keep local data", async () => {
    const d = await device();
    await d.signIn();
    await waitFor(() => d.platform.wasPersistenceRequested(), { message: "persistent storage requested" });
  });
});
