import { describe, expect, it, vi } from "vitest";
import { MatchSync } from "@/lib/rxdb/sync/match-sync";
import { ReferenceSync } from "@/lib/rxdb/sync/reference-sync";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import { AWAY_TEAM_ID, HOME_TEAM_ID, PLAYER_ID, USER_ID, aSet } from "../helpers/fixtures";
import { expectServerEqualsDevice, testUser } from "../helpers/test-device";
import { holdsFor, sleep, waitFor } from "../helpers/wait";
import { serverPoints as serverPointsOf, setupManagerSuite } from "./manager-helpers";

describe("SyncManager lifecycle", () => {
  const suite = setupManagerSuite();
  const serverPoints = () => serverPointsOf(suite.server(), suite.matchId());

  it("keeps every score update of a set, online and offline (root cause 1)", async () => {
    const d = await suite.device();
    await d.signIn();
    expect(await d.openMatch(suite.matchId())).toBe(true);
    const set = await d.startSet(suite.matchId());
    for (let n = 1; n <= 5; n++) await d.recordPoint(suite.matchId(), set.id, n);
    d.goOffline();
    for (let n = 6; n <= 10; n++) await d.recordPoint(suite.matchId(), set.id, n);
    d.goOnline();
    await d.settle(suite.matchId());
    expect(suite.server().row("sets", set.id)!.home_score).toBe(10);
    await expectServerEqualsDevice(d, suite.matchId());
  });

  it("keeps uploading after the profile is refreshed for the same user (root cause 2)", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.manager.setUser({ ...testUser() });
    d.goOnline();
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
  });

  it("restarts nothing when the profile is refreshed for the same user (root cause 2)", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    await d.manager.awaitMatchInSync(suite.matchId());
    const cancel = vi.spyOn(MatchSync.prototype, "cancel");
    const start = vi.spyOn(MatchSync.prototype, "start");
    const referenceStart = vi.spyOn(ReferenceSync.prototype, "start");
    const referenceStop = vi.spyOn(ReferenceSync.prototype, "stop");
    try {
      let stoppedTracking = false;
      const sampler = setInterval(() => {
        if (!d.manager.isTracking(suite.matchId())) stoppedTracking = true;
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
      expect(d.manager.isTracking(suite.matchId())).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("restarts the reference replications but keeps the match replications when the memberships of the user change", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    await d.manager.awaitMatchInSync(suite.matchId());
    const cancel = vi.spyOn(MatchSync.prototype, "cancel");
    const start = vi.spyOn(MatchSync.prototype, "start");
    const referenceStart = vi.spyOn(ReferenceSync.prototype, "start");
    try {
      let stoppedTracking = false;
      const sampler = setInterval(() => {
        if (!d.manager.isTracking(suite.matchId())) stoppedTracking = true;
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
      const set = await d.startSet(suite.matchId());
      await d.recordPoint(suite.matchId(), set.id, 1);
      await d.settle(suite.matchId());
      await expectServerEqualsDevice(d, suite.matchId());
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("uploads data recorded before the app was closed, without reopening the match (root cause 3)", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    for (let n = 1; n <= 3; n++) await d.recordPoint(suite.matchId(), set.id, n);
    await d.restart();
    d.goOnline();
    await d.signIn(); // the home screen: syncMatch is never called
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
  });

  it("survives repeated connection drops while scoring (root cause 4)", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    const set = await d.startSet(suite.matchId());
    for (let n = 1; n <= 6; n++) {
      if (n % 2 === 1) d.goOffline();
      else d.goOnline();
      await d.recordPoint(suite.matchId(), set.id, n);
      await sleep(30);
    }
    d.goOnline();
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
  });

  it("uploads a match that another tab opened (root cause 6)", async () => {
    const d = await suite.device();
    await d.signIn();
    const otherTab = new TrackedMatches(d.db); // another tab shares the device database
    await otherTab.track(suite.matchId(), USER_ID);
    await waitFor(() => d.manager.isTracking(suite.matchId()), { message: "the leader tracks the match" });
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
  });

  it("uploads 150 points (3 sets) recorded offline", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    for (let setNumber = 1; setNumber <= 3; setNumber++) {
      const set = await d.startSet(suite.matchId(), { set_number: setNumber });
      for (let n = 1; n <= 50; n++) await d.recordPoint(suite.matchId(), set.id, n);
    }
    d.goOnline();
    await d.settle(suite.matchId(), 60_000);
    expect(serverPoints()).toHaveLength(150);
    await expectServerEqualsDevice(d, suite.matchId());
  }, 90_000);

  it("finishes uploading after the app is closed in the middle of a push", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    for (let n = 1; n <= 30; n++) await d.recordPoint(suite.matchId(), set.id, n);
    suite.server().latencyMs = 20;
    d.goOnline();
    await waitFor(() => serverPoints().length >= 3, { message: "upload under way" });
    await d.restart();
    suite.server().latencyMs = 0;
    await d.signIn();
    await d.settle(suite.matchId(), 20_000);
    await expectServerEqualsDevice(d, suite.matchId());
    expect(await d.pending.count({ matchId: suite.matchId(), statuses: ["rejected"] })).toBe(0);
  }, 40_000);

  it("names a player deleted on the server and uploads the rest", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    suite.server().hardDelete("team_members", PLAYER_ID);
    d.goOnline();
    await waitFor(async () => (await d.pending.count({ matchId: suite.matchId(), statuses: ["rejected"] })) === 2, {
      message: "stat and point rejected",
    });
    const rejected = (await d.pending.collection.find({ selector: { status: "rejected" } }).exec()).map((doc) => doc.toJSON());
    expect(rejected.map((entry) => entry.error_code)).toEqual(["reference_missing", "reference_missing"]);
    expect(rejected[0].error_params).toEqual({ table: "team_members" });
    await waitFor(() => suite.server().row("sets", set.id)?.home_score === 1, { message: "set uploaded" });
  });

  it("rejects the rows of a rejected set with a reason, and retry uploads all of them", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    suite.server().denyWrites("sets", () => true);
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await waitFor(async () => (await d.pending.count({ matchId: suite.matchId(), statuses: ["rejected"] })) === 3, {
      message: "set, stat and point rejected",
      timeoutMs: 15_000,
    });
    const codes = Object.fromEntries(
      (await d.pending.collection.find({ selector: { status: "rejected" } }).exec()).map((doc) => [doc.table_name, doc.error_code])
    );
    expect(codes).toEqual({ sets: "rls", player_stats: "parent_rejected", score_points: "parent_rejected" });
    suite.server().allowWrites("sets");
    await d.manager.retryRejected(suite.matchId());
    await d.settle(suite.matchId(), 20_000);
    await expectServerEqualsDevice(d, suite.matchId());
  }, 40_000);

  it("ends undo and redo made offline with the right server state", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    const { point } = await d.recordPoint(suite.matchId(), set.id, 1);
    await d.db.score_points.findOne(point.id).remove(); // undo
    await d.db.score_points.insert({ ...point } as any); // redo
    d.goOnline();
    await d.settle(suite.matchId());
    expect(suite.server().row("score_points", point.id)!._deleted).toBe(false);
    await d.db.score_points.findOne(point.id).remove();
    await d.settle(suite.matchId());
    expect(suite.server().row("score_points", point.id)!._deleted).toBe(true);
  });

  it("re-sends a rejected removal when it is retried", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    const set = await d.startSet(suite.matchId());
    const { point } = await d.recordPoint(suite.matchId(), set.id, 1);
    await d.settle(suite.matchId());
    suite.server().denyWrites("score_points", (row) => row._deleted === true);
    await d.db.score_points.findOne(point.id).remove(); // undo
    await waitFor(async () => (await d.pending.get("score_points", point.id))?.status === "rejected", {
      message: "removal rejected",
    });
    expect(suite.server().row("score_points", point.id)!._deleted).toBe(false);
    suite.server().allowWrites("score_points");
    expect(await d.manager.retryRejected(suite.matchId())).toBe(1);
    await d.settle(suite.matchId());
    expect(suite.server().row("score_points", point.id)!._deleted).toBe(true);
    expect(await d.pending.count({ matchId: suite.matchId() })).toBe(0);
  });

  it("never shows a point inserted and undone before its first upload as live on the server", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    const { point } = await d.recordPoint(suite.matchId(), set.id, 1);
    await d.db.score_points.findOne(point.id).remove();
    d.goOnline();
    await d.settle(suite.matchId());
    const row = suite.server().row("score_points", point.id);
    expect(row === undefined || row._deleted === true).toBe(true);
  });

  it("resolves a match opened before sign-in as not synced when the manager is destroyed", async () => {
    const d = await suite.device();
    const opened = d.openMatch(suite.matchId()); // waits up to 5 s for a user
    const start = Date.now();
    await d.manager.destroy();
    expect(await opened).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(await d.manager.tracked.entry(suite.matchId())).toBeNull();
  });

  it("starts nothing for a match being opened when the manager is destroyed", async () => {
    const d = await suite.device();
    await d.signIn();
    const opened = d.manager.syncMatch(suite.matchId(), 5000);
    await d.manager.destroy();
    expect(await opened).toBe(false);
    await holdsFor(() => !d.manager.isTracking(suite.matchId()), 100, "nothing tracked after destroy");
    await d.manager.setUser(testUser());
    expect(d.manager.userId).toBeNull();
    expect(await d.manager.syncMatch(suite.matchId(), 5000)).toBe(false);
    expect(d.manager.isTracking(suite.matchId())).toBe(false);
  });

  it("does not turn a synced match back into syncing (the first pull may finish while it is opened)", async () => {
    const d = await suite.device();
    await d.signIn();
    expect(await d.openMatch(suite.matchId())).toBe(true);
    // Opened again: the status is read just before the first pull's "synced" lands.
    vi.spyOn(d.manager.syncStates, "get").mockResolvedValueOnce(null);
    try {
      expect(await d.manager.syncMatch(suite.matchId(), 500)).toBe(true);
      expect((await d.manager.syncStates.get(suite.matchId()))?.status).toBe("synced");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("keeps a match tracked while its replications are still being cancelled", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    await d.manager.awaitMatchInSync(suite.matchId());
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
      await holdsFor(() => d.manager.isTracking(suite.matchId()), 50, "tracked while cancelling");
      release();
      await signedOut;
      expect(d.manager.isTracking(suite.matchId())).toBe(false);
    } finally {
      release();
      vi.restoreAllMocks();
    }
  });

  it("tells whether a match it waits on is replicated", async () => {
    const d = await suite.device();
    await d.signIn();
    expect(await d.manager.awaitMatchInSync(suite.matchId())).toBe(false);
    await d.openMatch(suite.matchId());
    expect(await d.manager.awaitMatchInSync(suite.matchId())).toBe(true);
  });

  it("tracks a match opened before sign-in completes", async () => {
    const d = await suite.device();
    const opened = d.openMatch(suite.matchId()); // the live page's effect runs before the provider's setUser
    await d.signIn();
    expect(await opened).toBe(true);
    await waitFor(() => d.manager.isTracking(suite.matchId()), { message: "the match is tracked" });
  });

  it("still replicates tracked matches when the upgrade seeding fails", async () => {
    const d = await suite.device();
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
      await new TrackedMatches(d.db).track(suite.matchId(), USER_ID);
      await d.signIn();
      expect(failed).toBe(true);
      await waitFor(() => d.manager.isTracking(suite.matchId()), { message: "the match is tracked" });
      const set = await d.startSet(suite.matchId());
      await d.recordPoint(suite.matchId(), set.id, 1);
      await d.settle(suite.matchId());
      await expectServerEqualsDevice(d, suite.matchId());
      expect(warn).toHaveBeenCalledWith("[sync] upgrade seeding failed:", expect.any(Error));
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("refreshes a synced match on demand (rows pushed by another device since the last pull)", async () => {
    const d = await suite.device();
    await d.signIn();
    expect(await d.openMatch(suite.matchId())).toBe(true);
    await d.manager.awaitMatchInSync(suite.matchId());
    const set = suite.server().seed("sets", aSet(suite.matchId(), { set_number: 2 }));
    // no realtime stream: only a pull brings it
    await holdsFor(async () => (await d.db.sets.findOne(set.id).exec()) === null, 100, "no pull without a refresh");
    expect(await d.manager.refreshMatch(suite.matchId())).toBe(true);
    expect(await d.db.sets.findOne(set.id).exec()).not.toBeNull();
  });

  it("reports a refresh that can't finish in time", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    await d.startSet(suite.matchId());
    expect(await d.manager.refreshMatch(suite.matchId(), 200)).toBe(false);
  });

  it("asks the platform to keep local data", async () => {
    const d = await suite.device();
    await d.signIn();
    await waitFor(() => d.platform.wasPersistenceRequested(), { message: "persistent storage requested" });
  });
});
