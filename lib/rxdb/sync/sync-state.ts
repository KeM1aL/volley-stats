import type { LocalDatabase } from "../collections";
import { filter, firstValueFrom, map, of, timeout } from "rxjs";

/** Local doc `sync-state-<matchId>`: has this match's first pull completed on this device? */
export interface MatchSyncState {
  matchId: string;
  status: "never-synced" | "syncing" | "synced" | "error";
  lastSyncTime: number;
}

const docId = (matchId: string) => `sync-state-${matchId}`;

export class SyncStates {
  constructor(private readonly db: LocalDatabase) {}

  async get(matchId: string): Promise<MatchSyncState | null> {
    const doc = await this.db.getLocal<MatchSyncState>(docId(matchId));
    return doc ? (doc.toJSON().data as MatchSyncState) : null;
  }

  async set(matchId: string, status: MatchSyncState["status"]): Promise<void> {
    await this.db.upsertLocal<MatchSyncState>(docId(matchId), { matchId, status, lastSyncTime: Date.now() });
  }

  waitForSynced(matchId: string, timeoutMs: number): Promise<boolean> {
    return firstValueFrom(
      this.db.getLocal$<MatchSyncState>(docId(matchId)).pipe(
        map((doc) => (doc ? (doc.toJSON().data as MatchSyncState).status : null)),
        filter((status) => status === "synced"),
        map(() => true),
        timeout({ first: timeoutMs, with: () => of(false) })
      )
    );
  }
}
