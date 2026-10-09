import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalDatabase } from "../collections";
import type { TrackedMatches } from "./tracked-matches";

const UPGRADE_DOC = "sync-upgrade";
const ID_CHUNK = 100;

/** Ids among `ids` whose `matches` row exists on the server; null if the server can't be reached. */
async function existingOnServer(client: SupabaseClient<any>, ids: string[]): Promise<Set<string> | null> {
  const existing = new Set<string>();
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const { data, error } = await client.from("matches").select("id").in("id", ids.slice(start, start + ID_CHUNK));
    if (error) return null;
    for (const row of (data ?? []) as Array<{ id: string }>) existing.add(row.id);
  }
  return existing;
}

/**
 * First start after the sync rework (spec section 9): every match stored on
 * this device becomes a tracked match, so rows an older version never
 * uploaded are offered to the server once. Only matches the server still has
 * are seeded: matches are created online, so a missing one was deleted and
 * must not be re-created (spec section 5). Offline, nothing is seeded and the
 * upgrade runs again at the next start. Returns how many were added.
 */
export async function runSyncUpgrade(
  db: LocalDatabase,
  tracked: TrackedMatches,
  userId: string,
  client: SupabaseClient<any>
): Promise<number> {
  if (await db.getLocal(UPGRADE_DOC)) return 0;
  const existing = await tracked.get();
  const candidates = (await db.matches.find().exec()).map((doc) => doc.id).filter((id) => !existing[id]);
  const onServer = candidates.length > 0 ? await existingOnServer(client, candidates) : new Set<string>();
  if (!onServer) return 0;
  const matchIds = candidates.filter((id) => onServer.has(id));
  for (const matchId of matchIds) await tracked.track(matchId, userId);
  await db.upsertLocal(UPGRADE_DOC, { version: 2, ranAt: new Date().toISOString() });
  return matchIds.length;
}
