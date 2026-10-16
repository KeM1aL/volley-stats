import { describe, expect, it, vi } from "vitest";
import { DiscardBlockedError } from "@/lib/rxdb/sync/errors";
import { anEvent } from "../helpers/fixtures";
import { expectServerEqualsDevice } from "../helpers/test-device";
import { sleep, waitFor } from "../helpers/wait";
import { setupManagerSuite } from "./manager-helpers";

describe("discarding the changes the server refused", () => {
  const suite = setupManagerSuite();

  it("returns the refused rows to the server's version, drops their entries and leaves pending ones alone", async () => {
    const server = suite.server();
    const matchId = suite.matchId();
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(matchId);
    const set1 = await d.startSet(matchId);
    await d.settle(matchId);

    // The server refuses every set write: an update of the uploaded set, and a new set with its point.
    server.denyWrites("sets", () => true);
    await d.db.sets.findOne(set1.id).update({ $set: { home_score: 7 } });
    const set2 = await d.startSet(matchId, { set_number: 2 });
    const { stat, point } = await d.recordPoint(matchId, set2.id, 1);
    await waitFor(async () => (await d.pending.count({ matchId, statuses: ["rejected"] })) === 4, {
      message: "both sets, the stat and the point rejected",
      timeoutMs: 15_000,
    });
    // An event that can't reach the server yet: pending, not refused.
    server.failNextOn("events", ...Array(500).fill("network"));
    const event = anEvent(matchId, set1.id);
    await d.db.events.insert(event as any);
    await waitFor(async () => (await d.pending.get("events", event.id))?.status === "pending", { message: "event pending" });

    const logBefore = server.log.length;
    expect(await d.manager.discardRejected()).toBe(4);

    expect(await d.pending.count({ statuses: ["rejected"] })).toBe(0);
    expect(await d.pending.get("events", event.id)).toMatchObject({ status: "pending" });
    expect((await d.db.events.findOne(event.id).exec())?.id).toBe(event.id);
    // The device shows the server's version: the uploaded set as the server has it, the others gone.
    expect((await d.db.sets.findOne(set1.id).exec())?.home_score).toBe(server.row("sets", set1.id)!.home_score);
    expect(server.row("sets", set1.id)!.home_score).toBe(0);
    expect(await d.db.sets.findOne(set2.id).exec()).toBeNull();
    expect(await d.db.player_stats.findOne(stat.id).exec()).toBeNull();
    expect(await d.db.score_points.findOne(point.id).exec()).toBeNull();
    expect(d.manager.isTracking(matchId)).toBe(true);

    // The replications go on: the event uploads, nothing of the discarded rows is sent.
    server.allowWrites("sets");
    server.clearFaults();
    await d.settle(matchId);
    expect(server.row("events", event.id)).toBeDefined();
    const discardedIds = new Set<string>([set1.id, set2.id, stat.id, point.id]);
    const writesAfter = server.log
      .slice(logBefore)
      .filter((entry) => entry.op !== "select" && entry.op !== "rpc" && entry.ids.some((id) => discardedIds.has(id)));
    expect(writesAfter).toEqual([]);
    expect(server.row("sets", set2.id)).toBeUndefined();
    expect(server.row("score_points", point.id)).toBeUndefined();
    expect(await d.pending.count({ matchId })).toBe(0);
    await expectServerEqualsDevice(d, matchId);
  }, 40_000);

  it("brings back a row whose removal the server refused", async () => {
    const server = suite.server();
    const matchId = suite.matchId();
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(matchId);
    const set = await d.startSet(matchId);
    const { point } = await d.recordPoint(matchId, set.id, 1);
    await d.settle(matchId);
    server.denyWrites("score_points", (row) => row._deleted === true);
    await d.db.score_points.findOne(point.id).remove();
    await waitFor(async () => (await d.pending.get("score_points", point.id))?.status === "rejected", {
      message: "removal rejected",
    });

    expect(await d.manager.discardRejected(matchId)).toBe(1);

    expect(await d.pending.count({ matchId })).toBe(0);
    expect(await d.db.score_points.findOne(point.id).exec()).not.toBeNull();
    server.allowWrites("score_points");
    await d.settle(matchId);
    expect(server.row("score_points", point.id)!._deleted).toBe(false);
    await expectServerEqualsDevice(d, matchId);
  });

  it("keeps the refused changes when the server can't be read, and keeps replicating the match", async () => {
    const server = suite.server();
    const matchId = suite.matchId();
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(matchId);
    server.denyWrites("sets", () => true);
    const set = await d.startSet(matchId);
    await waitFor(async () => (await d.pending.get("sets", set.id))?.status === "rejected", { message: "set rejected" });

    d.goOffline();
    await expect(d.manager.discardRejected()).rejects.toBeTruthy();
    expect(await d.pending.get("sets", set.id)).toMatchObject({ status: "rejected" });
    expect(await d.db.sets.findOne(set.id).exec()).not.toBeNull();
    expect(d.manager.isTracking(matchId)).toBe(true);

    d.goOnline();
    expect(await d.manager.discardRejected()).toBe(1);
    expect(await d.db.sets.findOne(set.id).exec()).toBeNull();
    expect(await d.pending.count({ matchId })).toBe(0);
  });

  /** A match with one uploaded set whose update the server refused. */
  async function refusedSetUpdate(syncOptions = {}) {
    const server = suite.server();
    const matchId = suite.matchId();
    const d = await suite.device({ syncOptions });
    await d.signIn();
    await d.openMatch(matchId);
    const set = await d.startSet(matchId);
    await d.settle(matchId);
    server.denyWrites("sets", () => true);
    await d.db.sets.findOne(set.id).update({ $set: { home_score: 7 } });
    await waitFor(async () => (await d.pending.get("sets", set.id))?.status === "rejected", { message: "update rejected" });
    return { server, matchId, d, set };
  }

  it("keeps a change made to a refused row while the server is being read", async () => {
    const { server, matchId, d, set } = await refusedSetUpdate();
    // The read of the server's version (by id) waits; meanwhile the user edits the refused row again.
    server.hang("sets", (query) => query.op === "select" && query.ids().length > 0);
    const discarding = d.manager.discardRejected();
    await waitFor(() => server.hungCount > 0, { message: "server read under way" });
    await d.db.sets.findOne(set.id).update({ $set: { home_score: 9 } });
    expect(await d.pending.get("sets", set.id)).toMatchObject({ status: "pending" });
    server.releaseHung();

    expect(await discarding).toBe(0);
    expect((await d.db.sets.findOne(set.id).exec())?.home_score).toBe(9);
    expect(await d.pending.get("sets", set.id)).toMatchObject({ status: "pending" });
    expect(server.row("sets", set.id)!.home_score).toBe(0);
    expect(d.manager.isTracking(matchId)).toBe(true);
  });

  it("gives up on a server read that hangs: nothing changes and the match replicates again", async () => {
    const { server, matchId, d, set } = await refusedSetUpdate({ discardTimeoutMs: 300 });
    server.hang("sets", (query) => query.op === "select" && query.ids().length > 0);
    const started = Date.now();
    await expect(d.manager.discardRejected()).rejects.toMatchObject({ name: "DiscardBlockedError", reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(await d.pending.get("sets", set.id)).toMatchObject({ status: "rejected" });
    expect((await d.db.sets.findOne(set.id).exec())?.home_score).toBe(7);
    expect(d.manager.isTracking(matchId)).toBe(true);
    // The lifecycle queue isn't held up: opening the match again answers.
    expect(await d.openMatch(matchId)).toBe(true);
    // The abandoned read answering late discards nothing. (The restarted replication may itself bring
    // the server's version of the refused row back; its entry stays.)
    server.releaseHung();
    await sleep(200);
    expect(await d.pending.get("sets", set.id)).toMatchObject({ status: "rejected" });
  });

  it("says another tab leads instead of failing as if offline", async () => {
    const { d, set } = await refusedSetUpdate({ waitForLeadership: true, discardLeadershipTimeoutMs: 100 });
    vi.spyOn(d.db, "isLeader").mockReturnValue(false);
    vi.spyOn(d.db, "waitForLeadership").mockReturnValue(new Promise<boolean>(() => undefined));
    try {
      const error = await d.manager.discardRejected().catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(DiscardBlockedError);
      expect(error).toMatchObject({ reason: "other-tab" });
      expect(await d.pending.get("sets", set.id)).toMatchObject({ status: "rejected" });
    } finally {
      vi.restoreAllMocks();
    }
  });
});
