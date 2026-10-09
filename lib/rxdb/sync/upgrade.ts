import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalDatabase } from "../collections";
import type { PendingChanges, PendingDoc } from "./pending-changes";
import type { TrackedMatches } from "./tracked-matches";
import { MATCH_COLLECTIONS } from "./types";

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

async function hasSession(client: SupabaseClient<any>): Promise<boolean> {
  // Clients without `auth` (test fakes) count as signed in, as in replication.ts.
  if (!client.auth) return true;
  const { data } = await client.auth.getSession();
  return !!data.session;
}

/** The match's own date (never in the future), so the pruning forgets an old match once its rescue is done. */
function lastOpenedAtFor(date: unknown, now: string): string {
  const time = typeof date === "string" ? Date.parse(date) : Number.NaN;
  if (Number.isNaN(time)) return now;
  return time < Date.parse(now) ? new Date(time).toISOString() : now;
}

/** Every local row of the match is unsent until the server confirms it (sent$, or a settled outcome). */
async function markMatchPending(db: LocalDatabase, pending: PendingChanges, matchId: string): Promise<void> {
  for (const table of MATCH_COLLECTIONS) {
    const selector = table === "matches" ? { id: matchId } : { match_id: matchId };
    const docs = await (db[table] as any).find({ selector }).exec();
    for (const doc of docs) await pending.markPending(table, doc.toJSON() as PendingDoc);
  }
}

/**
 * First start after the sync rework (spec section 9): every match stored on
 * this device becomes a tracked match, so rows an older version never
 * uploaded are offered to the server once. Only matches the server still has
 * are seeded: matches are created online, so a missing one was deleted and
 * must not be re-created (spec section 5). Offline or without a session (RLS
 * would hide every match), nothing is seeded and the upgrade runs again at the
 * next start. The rows of a seeded match are marked pending, so the badge shows
 * the rescue until each one is confirmed. Returns how many matches were added.
 */
export async function runSyncUpgrade(
  db: LocalDatabase,
  tracked: TrackedMatches,
  pending: PendingChanges,
  userId: string,
  client: SupabaseClient<any>
): Promise<number> {
  if (await db.getLocal(UPGRADE_DOC)) return 0;
  const existing = await tracked.get();
  const localMatches = (await db.matches.find().exec()).filter((doc) => !existing[doc.id]);
  if (localMatches.length > 0 && !(await hasSession(client))) return 0;
  const onServer =
    localMatches.length > 0 ? await existingOnServer(client, localMatches.map((doc) => doc.id)) : new Set<string>();
  if (!onServer) return 0;
  const seeded = localMatches.filter((doc) => onServer.has(doc.id));
  const now = new Date().toISOString();
  for (const match of seeded) {
    // Marked before the match is tracked: its replications start as soon as it is.
    await markMatchPending(db, pending, match.id);
    await tracked.track(match.id, userId, lastOpenedAtFor(match.date, now));
  }
  await db.upsertLocal(UPGRADE_DOC, { version: 2, ranAt: now });
  return seeded.length;
}
