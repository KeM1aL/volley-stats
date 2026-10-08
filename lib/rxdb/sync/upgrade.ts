import type { LocalDatabase } from "../collections";
import type { TrackedMatches } from "./tracked-matches";

const UPGRADE_DOC = "sync-upgrade";

/**
 * First start after the sync rework (spec section 9): every match stored on
 * this device becomes a tracked match, so rows an older version never
 * uploaded are offered to the server once. Returns how many were added.
 */
export async function runSyncUpgrade(db: LocalDatabase, tracked: TrackedMatches, userId: string): Promise<number> {
  if (await db.getLocal(UPGRADE_DOC)) return 0;
  const existing = await tracked.get();
  const matchIds = (await db.matches.find().exec()).map((doc) => doc.id).filter((id) => !existing[id]);
  for (const matchId of matchIds) await tracked.track(matchId, userId);
  await db.upsertLocal(UPGRADE_DOC, { version: 2, ranAt: new Date().toISOString() });
  return matchIds.length;
}
