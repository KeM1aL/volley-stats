import { afterEach, beforeEach } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import type { SyncManagerOptions } from "@/lib/rxdb/sync/manager";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import {
  AWAY_TEAM_ID,
  FORMAT_ID,
  HOME_TEAM_ID,
  USER_ID,
  aScorePoint,
  aSet,
  seedServerMatch,
  seedTeams,
} from "../helpers/fixtures";
import { TestDevice } from "../helpers/test-device";

/** Registers the per-test fake server, seeded match and device cleanup; call once at the top of a describe. */
export function setupManagerSuite() {
  let server: FakeSupabaseServer;
  let matchId: string;
  const devices: TestDevice[] = [];
  beforeEach(() => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
  });
  afterEach(async () => {
    await Promise.all(devices.splice(0).map((d) => d.dispose()));
  });
  return {
    server: () => server,
    matchId: () => matchId,
    async device(options: { deviceId?: string; userName?: string; syncOptions?: Partial<SyncManagerOptions> } = {}) {
      const created = await TestDevice.create(server, options);
      devices.push(created);
      return created;
    },
  };
}

/** The live score points the server holds for a match. */
export const serverPoints = (server: FakeSupabaseServer, matchId: string) =>
  server.rows("score_points", (row) => row.match_id === matchId && !row._deleted);

export const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export async function leaveOldLocalMatch(d: TestDevice, id: string) {
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

/** What an older app version left on this device: the server's match and set, and a point never uploaded. */
export async function leaveRescuableMatch(d: TestDevice, id: string) {
  const { _deleted, ...matchDoc } = pickSchemaFields(
    d.server.row("matches", id)!,
    d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
  ) as Record<string, unknown>;
  await d.db.matches.insert(matchDoc as any);
  const set = aSet(id);
  await d.db.sets.insert(set as any);
  d.server.seed("sets", { ...set });
  const point = aScorePoint(id, set.id, 1);
  await d.db.score_points.insert(point as any);
  await d.pending.collection.find().remove(); // the old version had no pending_changes
  return { set, point };
}

/** A match this device lost: tracked as lost with one superseded change (two with `withPoint`). Offline, so nothing is pruned or checked yet. */
export async function leaveLostMatch(d: TestDevice, id: string, openedAt: string, withPoint = false) {
  const tracked = new TrackedMatches(d.db);
  await tracked.track(id, USER_ID, openedAt);
  await tracked.setClaim(id, "lost", null);
  const set = aSet(id);
  await d.db.sets.insert(set as any);
  const point = aScorePoint(id, set.id, 1);
  if (withPoint) await d.db.score_points.insert(point as any);
  await d.pending.supersedeMatch(id);
  return { tracked, set, point };
}

export const alignmentFailed = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.some(([message]) => String(message).includes("aligning it before pruning failed"));
