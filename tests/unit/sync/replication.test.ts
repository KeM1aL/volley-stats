import { afterEach, describe, expect, it } from "vitest";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { replicateSupabase } from "@/lib/rxdb/sync/replication";
import type { PushGate, PushReporter } from "@/lib/rxdb/sync/types";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createTestDb } from "../helpers/test-db";
import { createFakeServer } from "../helpers/server";
import { aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";
import { sleep, waitFor } from "../helpers/wait";

function recordingReporter(neverUploaded = new Set<string>(), notCreatedHere = new Set<string>()) {
  const calls = {
    rejected: [] as Array<{ id: string; code: string; neverUploaded: boolean }>,
    superseded: [] as string[],
    attempts: [] as string[],
  };
  const reporter: PushReporter = {
    rejected: async (doc, error, opts) => {
      calls.rejected.push({ id: doc.id, code: error.code, neverUploaded: opts.neverUploaded });
    },
    superseded: async (doc) => {
      calls.superseded.push(doc.id);
    },
    temporaryFailure: async (doc) => {
      calls.attempts.push(doc.id);
      return calls.attempts.filter((id) => id === doc.id).length;
    },
    neverUploaded: async (id) => neverUploaded.has(id),
    createdHere: async (id) => !notCreatedHere.has(id),
  };
  return { reporter, calls };
}

describe("replicateSupabase", () => {
  let db: LocalDatabase;
  let server: FakeSupabaseServer;
  let matchId: string;
  const states: RxReplicationState<any, any>[] = [];
  let signedIn = true;

  async function setup() {
    signedIn = true;
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
    ({ db } = await createTestDb());
  }

  function replicate(
    table: "matches" | "sets",
    extra: { identifier?: string; gate?: PushGate; reporter?: PushReporter; pullBatchSize?: number } = {}
  ) {
    const state = replicateSupabase({
      replicationIdentifier: extra.identifier ?? `test_${table}`,
      collection: db[table] as any,
      client: server.client({ signedIn: () => signedIn }),
      tableName: table,
      deviceId: "device-a",
      live: true,
      retryTime: 50,
      waitForLeadership: false,
      pull: {
        batchSize: extra.pullBatchSize,
        queryBuilder: (query) => (table === "matches" ? query.eq("id", matchId) : query.eq("match_id", matchId)),
      },
      push: { gate: extra.gate, reporter: extra.reporter },
    });
    states.push(state);
    return state;
  }

  afterEach(async () => {
    await Promise.all(states.splice(0).map((state) => state.cancel()));
    await db?.remove();
  });

  it("keeps every update of a set (updates used to be discarded as conflicts)", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    for (let score = 1; score <= 5; score++) {
      await db.sets.findOne(set.id).update({ $set: { home_score: score } });
      await waitFor(() => server.row("sets", set.id)?.home_score === score, { message: `score ${score} uploaded` });
    }
    for (let score = 6; score <= 10; score++) await db.sets.findOne(set.id).update({ $set: { home_score: score } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 10, { message: "score 10 uploaded" });
    await state.awaitInSync();
    expect((await db.sets.findOne(set.id).exec())!.home_score).toBe(10);
  });

  it("keeps the device's version when the server row changed under it", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    server.editAsWebsite("sets", set.id, { home_score: 99 });
    await db.sets.findOne(set.id).update({ $set: { home_score: 3 } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 3, { message: "device version on the server" });
    await state.awaitInSync();
    expect((await db.sets.findOne(set.id).exec())!.home_score).toBe(3);
  });

  it("drops server-only columns when pulling", async () => {
    await setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const state = replicate("matches");
    await state.awaitInitialReplication();
    const local = (await db.matches.findOne(matchId).exec())!.toJSON() as Record<string, unknown>;
    expect(local.id).toBe(matchId);
    expect(local).not.toHaveProperty("scorer_device_id");
    expect(local).not.toHaveProperty("_modified");
  });

  it("pulls new rows with the _modified checkpoint", async () => {
    await setup();
    server.seed("sets", aSet(matchId, { set_number: 1 }));
    const state = replicate("sets");
    await state.awaitInitialReplication();
    server.seed("sets", aSet(matchId, { set_number: 2 }));
    state.reSync();
    await waitFor(async () => (await db.sets.find().exec()).length === 2, { message: "second set pulled" });
  });

  it("pulls every row when several share one _modified across batch boundaries", async () => {
    await setup();
    const shared = server.now(); // right after the migration, every existing row has the same _modified
    const tied = [1, 2, 3, 4, 5].map((n) => server.seedAt("sets", aSet(matchId, { set_number: n }), shared));
    const later = server.seed("sets", aSet(matchId, { set_number: 6 }));
    const state = replicate("sets", { pullBatchSize: 2 });
    await state.awaitInitialReplication();
    const local = (await db.sets.find().exec()).map((doc) => doc.id).sort();
    expect(local).toEqual([...tied.map((row) => row.id), later.id].sort());
  });

  it("does not raise a conflict when an insert's response was lost", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const conflicts: unknown[] = [];
    state.conflict$.subscribe((conflict) => conflicts.push(conflict));
    server.loseNextResponse("sets");
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(
      () => server.log.filter((entry) => entry.table === "sets" && entry.op === "insert" && entry.ids.includes(set.id)).length >= 2,
      { message: "insert retried" }
    );
    await state.awaitInSync();
    expect(conflicts).toHaveLength(0);
  });

  it("keeps an edit made after an interrupted insert", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    server.loseNextResponse("sets");
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "insert committed" });
    await db.sets.findOne(set.id).update({ $set: { home_score: 4 } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 4, { message: "edit uploaded" });
  });

  it("does not let a stale local copy overwrite a later website correction", async () => {
    await setup();
    const set = aSet(matchId, { home_score: 7, updated_at: "2026-01-01T00:00:00.000Z" });
    server.seed("sets", { ...set });
    server.editAsWebsite("sets", set.id, { home_score: 10 });
    await db.sets.insert(set as any); // the copy an older app version left on the device
    const state = replicate("sets", { identifier: "fresh_after_upgrade" });
    await waitFor(async () => (await db.sets.findOne(set.id).exec())?.home_score === 10, { message: "device takes the correction" });
    await state.awaitInSync();
    expect(server.row("sets", set.id)!.home_score).toBe(10);
  });

  it("keeps sending the other rows when one is rejected", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    server.denyWrites("sets", (row) => row.set_number === 1);
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const first = aSet(matchId, { set_number: 1 });
    const second = aSet(matchId, { set_number: 2 });
    await db.sets.insert(first as any);
    await db.sets.insert(second as any);
    await waitFor(() => !!server.row("sets", second.id), { message: "second set uploaded" });
    expect(server.row("sets", first.id)).toBeUndefined();
    expect(calls.rejected).toEqual([{ id: first.id, code: "rls", neverUploaded: true }]);
  });

  it("leaves alone an upgraded row the server already has when it refuses the write", async () => {
    await setup();
    // Copies an older app version left on the device (no pending entry), and an edit made on this device.
    const upgraded = aSet(matchId, { set_number: 1, home_score: 7 });
    const edited = aSet(matchId, { set_number: 2, home_score: 7 });
    server.seed("sets", { ...upgraded, home_score: 9 });
    server.seed("sets", { ...edited, home_score: 9 });
    server.denyWrites("sets", () => true); // a club member who isn't the team owner
    await db.sets.bulkInsert([upgraded as any, edited as any]);
    const { reporter, calls } = recordingReporter(new Set(), new Set([upgraded.id]));
    const state = replicate("sets", { reporter, identifier: "fresh_after_upgrade" });
    await waitFor(() => calls.rejected.length > 0, { message: "the edited row rejected" });
    await state.awaitInSync();
    await sleep(200);
    expect(calls.rejected).toEqual([{ id: edited.id, code: "rls", neverUploaded: true }]);
    expect(calls.superseded).toEqual([]);
  });

  it("holds back rows the gate says must wait, without sending them", async () => {
    await setup();
    let ready = false;
    const gate: PushGate = { check: async () => (ready ? { kind: "send" } : { kind: "wait", reason: "parents" }) };
    const state = replicate("sets", { gate });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await sleep(200);
    expect(server.log.some((entry) => entry.table === "sets" && entry.op === "insert")).toBe(false);
    ready = true;
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded once the gate opened" });
  });

  it("does not resend or re-report a rejected row when another row of its batch is retried", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    server.denyWrites("sets", (row) => row.set_number === 1);
    let ready = false;
    const gate: PushGate = {
      check: async (doc) =>
        doc.set_number === 2 && !ready ? { kind: "wait", reason: "parents" } : { kind: "send" },
    };
    const state = replicate("sets", { reporter, gate });
    await state.awaitInitialReplication();
    const first = aSet(matchId, { set_number: 1 });
    const second = aSet(matchId, { set_number: 2 });
    // bulkInsert so that both rows are in the same push batch
    await db.sets.bulkInsert([first as any, second as any]);
    await sleep(300); // several retry cycles while the second set waits
    expect(calls.rejected).toEqual([{ id: first.id, code: "rls", neverUploaded: true }]);
    expect(server.log.filter((entry) => entry.table === "sets" && entry.op === "insert" && entry.ids.includes(first.id))).toHaveLength(1);
    ready = true;
    await waitFor(() => !!server.row("sets", second.id), { message: "second set uploaded once the gate opened" });
    expect(calls.rejected).toHaveLength(1);
  });

  it("reports rows refused because another device scores the match", async () => {
    await setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => calls.superseded.includes(set.id), { message: "superseded reported" });
    expect(server.row("sets", set.id)).toBeUndefined();
  });

  it("retries through a network outage without counting attempts", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    server.offline = true;
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await sleep(300);
    expect(server.row("sets", set.id)).toBeUndefined();
    server.offline = false;
    await waitFor(() => !!server.row("sets", set.id), { message: "uploaded after the outage" });
    expect(calls.attempts).toEqual([]);
    expect(calls.rejected).toEqual([]);
  });

  it("rejects a row whose parent never arrives after 20 attempts", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const orphan = aSet("20000000-0000-4000-8000-0000000000ff");
    await db.sets.insert(orphan as any);
    await waitFor(() => calls.rejected.some((call) => call.id === orphan.id), { message: "orphan rejected", timeoutMs: 15_000 });
    expect(calls.rejected.find((call) => call.id === orphan.id)!.code).toBe("too_many_attempts");
  });

  it("rejects, instead of re-creating, an update of a row deleted on the server", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    server.hardDelete("sets", set.id);
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    await waitFor(() => calls.rejected.some((call) => call.id === set.id), { message: "update rejected" });
    expect(calls.rejected[0].code).toBe("deleted_on_server");
    expect(server.row("sets", set.id)).toBeUndefined();
  });

  it("rejects an update the server silently refuses (RLS), without a request loop", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    await state.awaitInSync();
    server.hideFromUpdates("sets", (row) => row.id === set.id);
    const updates = () => server.log.filter((entry) => entry.table === "sets" && entry.op === "update").length;
    const before = updates();
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    await waitFor(() => calls.rejected.some((call) => call.id === set.id), { message: "update rejected" });
    await sleep(300);
    // One UPDATE is sent and its refusal is final, so the row is not sent again. The margin of 2 allows
    // for a push RxDB may already have queued; a conflict loop sends dozens in 300 ms (no retryTime applies).
    expect(updates() - before).toBeLessThanOrEqual(3);
    expect(calls.rejected).toEqual([{ id: set.id, code: "rls", neverUploaded: false }]);
    expect(server.row("sets", set.id)!.home_score).toBe(0);
  });

  it("waits, instead of rejecting, when an update without a session finds no row it can read", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    await state.awaitInSync();
    // The anon key (no session): RLS hides the row from the UPDATE (200, `[]`) and from the read-back.
    signedIn = false;
    server.hideFromUpdates("sets", (row) => row.id === set.id, { unreadable: true });
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    await sleep(300);
    expect(calls.rejected).toEqual([]);
    signedIn = true;
    server.showToUpdates("sets");
    await waitFor(() => server.row("sets", set.id)?.home_score === 2, { message: "update uploaded once signed in again" });
    expect(calls.rejected).toEqual([]);
  });

  it("waits, instead of rejecting, when an update without a session reads back the unchanged row", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    await state.awaitInSync();
    // Lost session: the UPDATE is refused (200, `[]`) but match tables are publicly readable, so the
    // read-back finds the row unchanged. That is the anon key, not a permanent RLS refusal.
    signedIn = false;
    server.hideFromUpdates("sets", (row) => row.id === set.id);
    const updates = () => server.log.filter((entry) => entry.table === "sets" && entry.op === "update").length;
    const before = updates();
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    await waitFor(() => updates() - before >= 2, { message: "update retried" });
    expect(calls.rejected).toEqual([]);
    signedIn = true;
    server.showToUpdates("sets");
    await waitFor(() => server.row("sets", set.id)?.home_score === 2, { message: "update uploaded once signed in again" });
    expect(calls.rejected).toEqual([]);
  });

  it("inserts a row the server never accepted when it is retried", async () => {
    await setup();
    const neverUploaded = new Set<string>();
    const { reporter } = recordingReporter(neverUploaded);
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    server.denyWrites("sets", () => true);
    const set = aSet(matchId);
    neverUploaded.add(set.id);
    await db.sets.insert(set as any);
    await sleep(200);
    server.allowWrites("sets");
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 1, { message: "row inserted on retry" });
  });

  it("sends x-device-id with every request", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    const requests = server.log.filter((entry) => entry.table === "sets");
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((entry) => entry.headers["x-device-id"] === "device-a")).toBe(true);
  });
});
