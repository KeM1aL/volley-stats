import { describe, expect, it } from "vitest";
import { USER_ID } from "../helpers/fixtures";
import { expectServerEqualsDevice, testUser } from "../helpers/test-device";
import { holdsFor, waitFor } from "../helpers/wait";
import { serverPoints as serverPointsOf, setupManagerSuite } from "./manager-helpers";

describe("SyncManager accounts", () => {
  const suite = setupManagerSuite();
  const serverPoints = () => serverPointsOf(suite.server(), suite.matchId());

  it("keeps the data after sign-out and uploads it when the same user signs back in", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await holdsFor(() => serverPoints().length === 0, 300, "no point uploaded while signed out");
    expect(await d.pending.count({ matchId: suite.matchId() })).toBeGreaterThan(0);
    await d.signIn();
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
  });

  it("does not upload another account's data", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await d.signIn(testUser("user-2"));
    await holdsFor(() => serverPoints().length === 0, 300, "no upload for another account");
    expect(await d.pending.count({ matchId: suite.matchId(), statuses: ["pending"] })).toBeGreaterThan(0);
  });

  it("does not hand another account's unsent match to the account that opens it", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await d.signIn(testUser("user-2"));
    await d.openMatch(suite.matchId());
    await d.manager.claimMatch(suite.matchId()).catch(() => undefined);
    expect((await d.manager.tracked.entry(suite.matchId()))?.userId).toBe(USER_ID);
    await holdsFor(
      () => !d.manager.isTracking(suite.matchId()) && serverPoints().length === 0,
      300,
      "the match stays untracked and unsent"
    );
  });

  it("hands a match to the account that opens it once nothing of it is unsent", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.settle(suite.matchId());
    await d.manager.setUser(null);
    await d.signIn(testUser("user-2"));
    await d.openMatch(suite.matchId());
    expect((await d.manager.tracked.entry(suite.matchId()))?.userId).toBe("user-2");
    await waitFor(() => d.manager.isTracking(suite.matchId()), { message: "user-2 replicates the match" });
  });

  it("continues after the access token expired during a long offline period", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.recordPoint(suite.matchId(), set.id, 2);
    suite.server().failNext("jwt-expired", "jwt-expired", "jwt-expired");
    d.goOnline();
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
    expect(await d.pending.count({ matchId: suite.matchId(), statuses: ["rejected"] })).toBe(0);
  });

  it("continues after requests went out with the anon key (session lost, RLS answers 401)", async () => {
    const d = await suite.device();
    await d.signIn();
    await d.openMatch(suite.matchId());
    d.goOffline();
    const set = await d.startSet(suite.matchId());
    await d.recordPoint(suite.matchId(), set.id, 1);
    await d.recordPoint(suite.matchId(), set.id, 2);
    suite.server().failNextWrites("anon-rls", "anon-rls", "anon-rls");
    d.goOnline();
    await d.settle(suite.matchId());
    await expectServerEqualsDevice(d, suite.matchId());
    expect(await d.pending.count({ matchId: suite.matchId(), statuses: ["rejected"] })).toBe(0);
  });
});
