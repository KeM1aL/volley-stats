import { describe, expect, it, vi } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import { USER_ID, aSet, seedServerMatch } from "../helpers/fixtures";
import { testUser } from "../helpers/test-device";
import { waitFor } from "../helpers/wait";
import { alignmentFailed, daysAgo, leaveLostMatch, setupManagerSuite } from "./manager-helpers";

describe("SyncManager: a lost match nobody takes back", () => {
  const suite = setupManagerSuite();

  it("is kept while it was opened within 14 days (the take-back needs its superseded changes)", async () => {
    const d = await suite.device();
    const { tracked, set } = await leaveLostMatch(d, suite.matchId(), daysAgo(10));
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(suite.matchId())).toMatchObject({ claim: "lost" });
    expect((await d.pending.get("sets", set.id))?.status).toBe("superseded");
  });

  it("is aligned with the server and pruned once unopened for 14 days: the superseded rows never reach the server", async () => {
    const d = await suite.device();
    const { tracked, set } = await leaveLostMatch(d, suite.matchId(), daysAgo(15));
    await d.signIn();
    await waitFor(async () => (await tracked.entry(suite.matchId())) === null, { message: "the lost match is pruned" });
    expect(await d.pending.get("sets", set.id)).toBeNull();
    expect(await d.pending.count({ matchId: suite.matchId() })).toBe(0);
    // The local-only row is gone from the device (a tombstone), and neither it nor a removal was sent.
    expect(await d.db.sets.findOne(set.id).exec()).toBeNull();
    expect(suite.server().row("sets", set.id)).toBeUndefined();
    expect(suite.server().log.filter((entry) => entry.table === "sets" && entry.op !== "select")).toEqual([]);
    await d.restart();
    await d.signIn();
    expect(suite.server().log.filter((entry) => entry.table === "sets" && entry.op !== "select")).toEqual([]);
  });

  it("is replaced by the server's version of a superseded row", async () => {
    const d = await suite.device();
    const onServer = suite.server().seed("sets", aSet(suite.matchId(), { home_score: 7 }));
    const tracked = new TrackedMatches(d.db);
    await tracked.track(suite.matchId(), USER_ID, daysAgo(15));
    await tracked.setClaim(suite.matchId(), "lost", null);
    const { _deleted, ...doc } = pickSchemaFields(onServer, d.db.sets.schema.jsonSchema.properties as Record<string, unknown>);
    await d.db.sets.insert({ ...doc, home_score: 2 } as any);
    await d.pending.supersedeMatch(suite.matchId());
    await d.signIn();
    await waitFor(async () => (await tracked.entry(suite.matchId())) === null, { message: "the lost match is pruned" });
    expect(await d.pending.count({ matchId: suite.matchId() })).toBe(0);
    expect((await d.db.sets.findOne(onServer.id).exec())?.home_score).toBe(7);
    expect(suite.server().row("sets", onServer.id)!.home_score).toBe(7);
  });

  it("stays tracked, with its superseded changes, while the server can't be reached (retried at the next start)", async () => {
    const d = await suite.device();
    const { tracked, set } = await leaveLostMatch(d, suite.matchId(), daysAgo(15));
    d.goOffline();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await d.signIn();
      await waitFor(() => alignmentFailed(warn), { message: "the failed alignment is logged" });
      expect(await tracked.entry(suite.matchId())).toMatchObject({ claim: "lost" });
      expect((await d.pending.get("sets", set.id))?.status).toBe("superseded");
      expect(await d.db.sets.findOne(set.id).exec()).not.toBeNull();
      d.goOnline();
      await d.restart();
      await d.signIn();
      await waitFor(async () => (await tracked.entry(suite.matchId())) === null, { message: "pruned at the next start" });
      expect(await d.pending.get("sets", set.id)).toBeNull();
      expect(await d.db.sets.findOne(set.id).exec()).toBeNull();
      expect(suite.server().row("sets", set.id)).toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });

  it("aligns several tables, and a later table failing leaves the rest for the next start", async () => {
    const d = await suite.device();
    const { tracked, set, point } = await leaveLostMatch(d, suite.matchId(), daysAgo(15), true);
    expect(await d.pending.count({ matchId: suite.matchId(), statuses: ["superseded"] })).toBe(2);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      // Tables are aligned in sync order (sets before score_points): reading the second one fails once.
      suite.server().failNextOn("score_points", "network");
      await d.signIn();
      await waitFor(() => alignmentFailed(warn), { message: "the failed alignment is logged" });
      expect(await d.pending.get("sets", set.id)).toBeNull(); // aligned, its entry deleted
      expect(await d.db.sets.findOne(set.id).exec()).toBeNull();
      expect((await d.pending.get("score_points", point.id))?.status).toBe("superseded"); // still to do
      expect(await d.db.score_points.findOne(point.id).exec()).not.toBeNull();
      expect(await tracked.entry(suite.matchId())).toMatchObject({ claim: "lost" });

      await d.restart();
      await d.signIn();
      await waitFor(async () => (await tracked.entry(suite.matchId())) === null, { message: "pruned at the next start" });
      expect(await d.pending.count({ matchId: suite.matchId() })).toBe(0);
      expect(await d.db.score_points.findOne(point.id).exec()).toBeNull();
      expect(suite.server().rows("score_points", (row) => row.id === point.id)).toEqual([]);
      expect(suite.server().log.filter((entry) => ["sets", "score_points"].includes(entry.table) && entry.op !== "select")).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it("does not make anything wait for a server that never answers it: other matches open, the lost one stays tracked, a timeout is a failure", async () => {
    const d = await suite.device({ syncOptions: { pruneAlignTimeoutMs: 1500 } });
    const { tracked, set } = await leaveLostMatch(d, suite.matchId(), daysAgo(15));
    const otherMatchId = seedServerMatch(suite.server());
    // The alignment reads the lost match's rows by id; pulls of other matches (by match_id) are not affected.
    suite.server().hang("sets", (query) => query.ids().length > 0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await d.signIn();
      expect(await d.manager.syncMatch(otherMatchId, 5000)).toBe(true);
      // The other match opened while the alignment was still waiting on the hung server:
      expect(alignmentFailed(warn)).toBe(false);
      await d.manager.refreshMatch(otherMatchId);
      await d.manager.setUser(testUser()); // the lifecycle queue is free
      await waitFor(() => alignmentFailed(warn), { message: "the alignment gave up after its timeout" });
      expect(await tracked.entry(suite.matchId())).toMatchObject({ claim: "lost" });
      expect((await d.pending.get("sets", set.id))?.status).toBe("superseded");

      // The next start, with the server answering, finishes the pruning.
      suite.server().releaseHung();
      await d.restart();
      await d.signIn();
      await waitFor(async () => (await tracked.entry(suite.matchId())) === null, { message: "pruned at the next start" });
    } finally {
      suite.server().releaseHung();
      warn.mockRestore();
    }
  });

  it("stops aligning once the account changes or the manager is destroyed, before writing anything more", async () => {
    const d = await suite.device();
    const { tracked, set, point } = await leaveLostMatch(d, suite.matchId(), daysAgo(15), true);
    // The first table's read hangs: the run is in flight when the account changes.
    suite.server().hang("sets", (query) => query.ids().length > 0);
    try {
      await d.signIn();
      await waitFor(() => suite.server().hungCount > 0, { message: "the alignment reads the lost match's sets" });
      await d.manager.setUser(testUser("user-2"));
      suite.server().releaseHung();
      await d.manager.destroy();
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Nothing aligned or untracked for the previous account: its next start does it.
      expect((await d.pending.get("sets", set.id))?.status).toBe("superseded");
      expect((await d.pending.get("score_points", point.id))?.status).toBe("superseded");
      expect(await d.db.sets.findOne(set.id).exec()).not.toBeNull();
      expect(await tracked.entry(suite.matchId())).toMatchObject({ claim: "lost", userId: USER_ID });
    } finally {
      suite.server().releaseHung();
    }
  });

  it("is kept when something of it is still unsent", async () => {
    const d = await suite.device();
    const { tracked } = await leaveLostMatch(d, suite.matchId(), daysAgo(15));
    const unsent = aSet(suite.matchId(), { set_number: 2 });
    await d.db.sets.insert(unsent as any); // written after the loss: its entry is pending
    expect((await d.pending.get("sets", unsent.id))?.status).toBe("pending");
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(suite.matchId())).toMatchObject({ claim: "lost" });
    expect(await d.pending.count({ matchId: suite.matchId(), statuses: ["superseded"] })).toBe(1);
  });

  it("is not asked about on resume once unopened for 14 days, a recent one still is", async () => {
    const d = await suite.device();
    await d.signIn();
    const oldMatchId = seedServerMatch(suite.server());
    const recentMatchId = seedServerMatch(suite.server());
    await d.manager.tracked.track(oldMatchId, USER_ID, daysAgo(15));
    await d.manager.tracked.setClaim(oldMatchId, "lost", null);
    await d.manager.tracked.track(recentMatchId, USER_ID, daysAgo(2));
    await d.manager.tracked.setClaim(recentMatchId, "lost", null);
    await d.manager.checkClaims();
    const asked = suite.server().log.filter((entry) => entry.table === "rpc:get_match_scorer").flatMap((entry) => entry.ids);
    expect(asked).toContain(recentMatchId);
    expect(asked).not.toContain(oldMatchId);
  });
});
