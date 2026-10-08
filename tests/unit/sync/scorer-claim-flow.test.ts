import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import { aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";
import { TestDevice, expectServerEqualsDevice } from "../helpers/test-device";
import { waitFor } from "../helpers/wait";

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

  it("notices a takeover when the app comes back to the foreground", async () => {
    const a = await device();
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    a.platform.foreground();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "takeover noticed" });
    await waitFor(() => !a.manager.isTracking(matchId), { message: "replication stopped" });
  });
});
