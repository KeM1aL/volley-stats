import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import { aSet, anEvent, seedServerMatch, seedTeams } from "../helpers/fixtures";
import { TestDevice, expectServerEqualsDevice } from "../helpers/test-device";
import { sleep, waitFor } from "../helpers/wait";

describe("scoring device claim", () => {
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
    await created.signIn();
    return created;
  }

  it("claims a free match silently", async () => {
    const a = await device();
    await a.openMatch(matchId);
    expect((await a.manager.claimMatch(matchId)).claimed).toBe(true);
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("held");
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
  });

  it("reports the device holding the match and takes over when forced", async () => {
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam", label: "iPad" });
    const a = await device();
    await a.openMatch(matchId);
    expect(await a.manager.claimMatch(matchId)).toMatchObject({
      claimed: false,
      holder: { deviceId: "device-b", name: "Sam", deviceLabel: "iPad" },
    });
    expect((await a.manager.claimMatch(matchId, true)).claimed).toBe(true);
  });

  it("confirms an offline claim before any row of the match uploads", async () => {
    server.setScorer(matchId, { deviceId: "device-b" });
    const a = await device();
    await a.openMatch(matchId);
    a.goOffline();
    await a.manager.claimMatchOffline(matchId);
    const set = await a.startSet(matchId);
    await a.recordPoint(matchId, set.id, 1);
    a.goOnline();
    await a.settle(matchId);
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
    const claimIndex = server.log.findIndex((entry) => entry.table === "rpc:claim_match_scorer" && entry.status === 200);
    const firstSetWrite = server.log.findIndex((entry) => entry.table === "sets" && entry.op !== "select" && entry.status < 300);
    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(claimIndex).toBeLessThan(firstSetWrite);
    await expectServerEqualsDevice(a, matchId);
  });

  it("keeps the previous device's unsent changes on that device after a takeover", async () => {
    const a = await device({ deviceId: "device-a", userName: "Alex" });
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    a.goOffline();
    const setA = await a.startSet(matchId);
    await a.recordPoint(matchId, setA.id, 1);

    // Device B takes the match over and scores a set. It is played on the server directly: RxDB's free
    // edition caps the open collections of a process at 13, so a second full device database cannot exist.
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    const setB = server.seed("sets", aSet(matchId, { set_number: 2 }));

    a.goOnline();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "A sees the takeover" });
    await waitFor(async () => (await a.pending.count({ matchId, statuses: ["pending"] })) === 0, { message: "nothing pending on A" });
    expect(await a.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
    expect(await a.pending.count({ matchId, statuses: ["superseded"] })).toBeGreaterThan(0);
    expect((await a.manager.tracked.entry(matchId))?.lostTo).toMatchObject({ deviceId: "device-b", name: "Sam" });
    expect(server.row("sets", setA.id)).toBeUndefined();
    expect(server.row("sets", setB.id)).toBeDefined();
  });

  it("asks the server who holds the match once for a burst of superseded rows", async () => {
    const a = await device();
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    const set = await a.startSet(matchId);
    await a.settle(matchId);
    a.online = false; // requests fail; the platform isn't told, so no resume checks the claims
    for (let n = 1; n <= 4; n++) await a.recordPoint(matchId, set.id, n);
    await a.db.events.insert(anEvent(matchId, set.id) as any);
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    const holderRequests = () => server.log.filter((entry) => entry.table === "rpc:get_match_scorer").length;
    expect(holderRequests()).toBe(0);
    a.online = true;
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "A sees the takeover" });
    await sleep(300);
    expect(holderRequests()).toBe(1);
  });

  it("does not keep tracking a match whose claim the server refuses", async () => {
    const a = await device();
    const unknownMatchId = "20000000-0000-4000-8000-0000000000ee"; // not on the server for this user: P0002
    await expect(a.manager.claimMatch(unknownMatchId)).rejects.toMatchObject({ code: "P0002" });
    expect(await a.manager.tracked.entry(unknownMatchId)).toBeNull();
    // A match tracked before the refusal stays tracked.
    await a.openMatch(matchId);
    server.hardDelete("matches", matchId);
    await expect(a.manager.claimMatch(matchId)).rejects.toMatchObject({ code: "P0002" });
    expect(await a.manager.tracked.entry(matchId)).not.toBeNull();
  });

  it("notices a takeover when the app comes back to the foreground", async () => {
    const a = await device();
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    a.platform.foreground();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "takeover noticed" });
    await waitFor(() => !a.manager.isTracking(matchId), { message: "replication stopped" });
  });

  it("replicates the match again after taking scoring back", async () => {
    const a = await device();
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    a.platform.foreground();
    await waitFor(() => !a.manager.isTracking(matchId), { message: "replication stopped after the takeover" });
    expect((await a.manager.claimMatch(matchId, true)).claimed).toBe(true);
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("held");
    await waitFor(() => a.manager.isTracking(matchId), { message: "replication restarted" });
    const set = await a.startSet(matchId);
    await a.settle(matchId);
    expect(server.row("sets", set.id)).toBeDefined();
  });

  it("does not mark the match lost when the server says this device holds it", async () => {
    const a = await device({ deviceId: "device-a" });
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    a.goOffline();
    const set = await a.startSet(matchId);
    // A superseded parent left over from an earlier takeover: its children are superseded by the gate.
    await a.pending.supersede("sets", set);
    const { point } = await a.recordPoint(matchId, set.id, 1);
    a.goOnline();
    await waitFor(async () => (await a.pending.get("score_points", point.id))?.status === "superseded", {
      message: "the point superseded behind its parent",
    });
    await waitFor(() => server.log.some((entry) => entry.table === "rpc:get_match_scorer"), { message: "holder fetched" });
    await sleep(200);
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("held");
    expect(a.manager.isTracking(matchId)).toBe(true);
  });

  it("keeps a lost claim lost when asked to score offline (taking back needs the server)", async () => {
    const a = await device();
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    a.platform.foreground();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "takeover noticed" });
    a.goOffline();
    await expect(a.manager.takeBackMatch(matchId)).rejects.toThrow();
    await a.manager.claimMatchOffline(matchId);
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("lost");
    expect(a.manager.isTracking(matchId)).toBe(false);
  });

  it("takes scoring back after a takeover that superseded unsent changes: device = server, then scores again", async () => {
    const a = await device({ deviceId: "device-a", userName: "Alex" });
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    const set1 = await a.startSet(matchId);
    await a.settle(matchId);

    // Offline: a point in the uploaded set (the set row changes too) and a new set with a point.
    a.goOffline();
    const offline1 = await a.recordPoint(matchId, set1.id, 1);
    const set2 = await a.startSet(matchId, { set_number: 2 });
    const offline2 = await a.recordPoint(matchId, set2.id, 1);
    const neverUploaded = [
      ["player_stats", offline1.stat.id],
      ["score_points", offline1.point.id],
      ["sets", set2.id],
      ["player_stats", offline2.stat.id],
      ["score_points", offline2.point.id],
    ] as const;

    // Device B takes over and scores a set (played on the server, see the takeover test above).
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    const setB = server.seed("sets", { ...aSet(matchId, { set_number: 2 }), home_score: 4 });

    a.goOnline();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "A sees the takeover" });
    await waitFor(async () => (await a.pending.count({ matchId, statuses: ["pending"] })) === 0, { message: "nothing pending on A" });
    expect(await a.pending.count({ matchId, statuses: ["superseded"] })).toBeGreaterThan(0);

    const logBefore = server.log.length;
    const result = await a.manager.takeBackMatch(matchId);
    expect(result).toMatchObject({ claim: { claimed: true }, refreshed: true });
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("held");
    expect(a.manager.isTracking(matchId)).toBe(true);
    expect(await a.pending.count({ matchId, statuses: ["superseded"] })).toBe(0);
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");

    // This device's superseded changes are gone: it shows the match as the server has it.
    await expectServerEqualsDevice(a, matchId);
    expect(server.row("sets", set1.id)!.home_score).toBe(0);
    expect((await a.db.sets.findOne(set1.id).exec())?.home_score).toBe(0);
    expect(await a.db.sets.findOne(setB.id).exec()).not.toBeNull();
    for (const [table, id] of neverUploaded) {
      expect(server.row(table, id), `${table} ${id} not on the server`).toBeUndefined();
      expect(await (a.db[table] as any).findOne(id).exec(), `${table} ${id} removed locally`).toBeNull();
    }
    // Nothing of the discarded changes was sent: no insert, no tombstone.
    const discardedIds = new Set<string>(neverUploaded.map(([, id]) => id));
    const writesAfter = server.log
      .slice(logBefore)
      .filter((entry) => entry.op !== "select" && entry.op !== "rpc" && entry.ids.some((id) => discardedIds.has(id)));
    expect(writesAfter).toEqual([]);

    // The claim stays held and a new point uploads.
    const next = await a.recordPoint(matchId, setB.id, 5);
    await a.settle(matchId);
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("held");
    expect(server.row("score_points", next.point.id)).toBeDefined();
    expect(server.row("player_stats", next.stat.id)).toBeDefined();
    expect(server.row("sets", setB.id)!.home_score).toBe(5);
    await expectServerEqualsDevice(a, matchId);
  });
});
