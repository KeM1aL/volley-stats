import { describe, expect, it } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import { USER_ID, aScorePoint, aSet, seedServerMatch } from "../helpers/fixtures";
import { holdsFor, waitFor } from "../helpers/wait";
import { leaveOldLocalMatch, leaveRescuableMatch, setupManagerSuite } from "./manager-helpers";

describe("SyncManager upgrade", () => {
  const suite = setupManagerSuite();

  it("upgrade: rescues rows missing on the server without overwriting later corrections", async () => {
    const d = await suite.device();
    // What an older app version left on this device: the match, a set and two points never uploaded.
    const { _deleted, ...matchDoc } = pickSchemaFields(
      suite.server().row("matches", suite.matchId())!,
      d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await d.db.matches.insert(matchDoc as any);
    const set = aSet(suite.matchId(), { home_score: 7, updated_at: "2026-01-01T00:00:00.000Z" });
    await d.db.sets.insert(set as any);
    const points = [aScorePoint(suite.matchId(), set.id, 1), aScorePoint(suite.matchId(), set.id, 2)];
    for (const point of points) await d.db.score_points.insert(point as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
    suite.server().seed("sets", { ...set });
    suite.server().editAsWebsite("sets", set.id, { home_score: 10 });

    await d.signIn();

    await waitFor(() => points.every((point) => !!suite.server().row("score_points", point.id)), { message: "points rescued" });
    await waitFor(async () => (await d.db.sets.findOne(set.id).exec())?.home_score === 10, {
      message: "device takes the correction",
    });
    expect(suite.server().row("sets", set.id)!.home_score).toBe(10);
  });

  it("upgrade: does not lose a match another device already scores", async () => {
    const d = await suite.device();
    const { _deleted, ...matchDoc } = pickSchemaFields(
      suite.server().row("matches", suite.matchId())!,
      d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await d.db.matches.insert(matchDoc as any);
    const set = aSet(suite.matchId());
    await d.db.sets.insert(set as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
    suite.server().seed("sets", { ...set });
    suite.server().setScorer(suite.matchId(), { deviceId: "device-b", name: "Sam" }); // the tablet upgraded first and claimed

    await d.signIn();

    await waitFor(async () => (await d.manager.tracked.entry(suite.matchId())) !== null, { message: "the match is seeded" });
    // the seeded rows are pushed once
    await holdsFor(async () => (await d.manager.tracked.entry(suite.matchId()))?.claim !== "lost", 500, "the seeded match is not marked lost");
    expect(d.manager.isTracking(suite.matchId())).toBe(true);
    expect(await d.pending.count({ matchId: suite.matchId() })).toBe(0);
  });

  it("upgrade: does not re-create a match deleted on the server", async () => {
    const d = await suite.device();
    const deletedMatchId = "20000000-0000-4000-8000-0000000000dd";
    await leaveOldLocalMatch(d, deletedMatchId);
    await d.signIn();
    await waitFor(async () => !!(await d.db.getLocal("sync-upgrade")), { message: "upgrade done" });
    await holdsFor(
      async () => (await d.manager.tracked.entry(deletedMatchId)) === null && suite.server().row("matches", deletedMatchId) === undefined,
      200,
      "the deleted match stays deleted"
    );
  });

  it("upgrade: seeds nothing offline and runs again at the next start", async () => {
    const d = await suite.device();
    await leaveOldLocalMatch(d, suite.matchId());
    d.goOffline();
    await d.signIn();
    expect(await d.manager.tracked.entry(suite.matchId())).toBeNull();
    expect(await d.db.getLocal("sync-upgrade")).toBeNull();
    await d.restart();
    d.goOnline();
    await d.signIn();
    expect(await d.manager.tracked.entry(suite.matchId())).not.toBeNull();
    expect(await d.db.getLocal("sync-upgrade")).not.toBeNull();
  });

  it("upgrade: shows the rescued rows as unsent until the server confirms them", async () => {
    const d = await suite.device();
    const { point } = await leaveRescuableMatch(d, suite.matchId());
    const counts: number[] = [];
    const subscription = d.pending.count$({ matchId: suite.matchId(), statuses: ["pending"] }).subscribe((count) => counts.push(count));
    try {
      await d.signIn();
      await waitFor(() => !!suite.server().row("score_points", point.id), { message: "point rescued" });
      await d.settle(suite.matchId());
      expect(Math.max(...counts)).toBe(3); // the match, the set and the point
      expect(await d.pending.count({ matchId: suite.matchId() })).toBe(0);
    } finally {
      subscription.unsubscribe();
    }
  });

  it("upgrade: keeps an old match while its rescue runs, then forgets it", async () => {
    const d = await suite.device();
    const oldMatchId = seedServerMatch(suite.server(), { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() });
    await leaveRescuableMatch(d, oldMatchId);
    suite.server().failNextWrites(...Array(1000).fill("network")); // the upgrade's read goes through, the rescue doesn't
    await d.signIn();
    expect(await d.manager.tracked.entry(oldMatchId)).not.toBeNull();
    expect(await d.pending.count({ matchId: oldMatchId, statuses: ["pending"] })).toBe(3);
    await d.restart();
    await d.signIn();
    expect(await d.manager.tracked.entry(oldMatchId)).not.toBeNull(); // still unsent: kept
    suite.server().clearFaults();
    await d.settle(oldMatchId);
    await d.restart();
    await d.signIn();
    expect(await d.manager.tracked.entry(oldMatchId)).toBeNull();
  });

  it("upgrade: seeds nothing without a session (the server would hide every match)", async () => {
    const d = await suite.device();
    await leaveOldLocalMatch(d, suite.matchId());
    d.signedIn = false;
    await d.signIn();
    expect(await d.manager.tracked.entry(suite.matchId())).toBeNull();
    expect(await d.db.getLocal("sync-upgrade")).toBeNull();
    d.signedIn = true;
    await d.restart();
    await d.signIn();
    expect(await d.manager.tracked.entry(suite.matchId())).not.toBeNull();
  });

  it("forgets matches unopened for 14 days once nothing is unsent", async () => {
    const d = await suite.device();
    const tracked = new TrackedMatches(d.db);
    const longAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const otherMatchId = seedServerMatch(suite.server());
    await tracked.track(suite.matchId(), USER_ID, longAgo);
    await tracked.track(otherMatchId, USER_ID, longAgo);
    await d.db.sets.insert(aSet(otherMatchId) as any); // unsent: this match must stay tracked
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(suite.matchId())).toBeNull();
    expect(await tracked.entry(otherMatchId)).not.toBeNull();
  });

  it("forgets a match whose last-opened date is unreadable", async () => {
    const d = await suite.device();
    const tracked = new TrackedMatches(d.db);
    await tracked.track(suite.matchId(), USER_ID, "not a date");
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(suite.matchId())).toBeNull();
  });
});
