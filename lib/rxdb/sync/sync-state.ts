import type { LocalDatabase } from "../collections";
import { filter, firstValueFrom, map, NEVER, of, takeUntil, timeout, type Observable } from "rxjs";

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

  /**
   * Marks the match "syncing" unless its first pull already completed (read and written in one
   * step). Returns whether it had: then the status stays "synced".
   */
  async markSyncing(matchId: string): Promise<boolean> {
    const id = docId(matchId);
    const syncing: MatchSyncState = { matchId, status: "syncing", lastSyncTime: Date.now() };
    let doc = await this.db.getLocal<MatchSyncState>(id);
    if (!doc) {
      try {
        await this.db.insertLocal<MatchSyncState>(id, syncing);
        return false;
      } catch (err) {
        // Written meanwhile (the first pull completed): decide on that version.
        if ((err as { status?: number })?.status !== 409) throw err;
        doc = await this.db.getLocal<MatchSyncState>(id);
        if (!doc) throw err;
      }
    }
    let synced = false;
    await doc.incrementalModify((current: MatchSyncState) => {
      synced = current.status === "synced";
      return synced ? current : syncing;
    });
    return synced;
  }

  /** Resolves true once the match is synced, false after `timeoutMs` or when `cancel$` emits. */
  waitForSynced(matchId: string, timeoutMs: number, cancel$: Observable<unknown> = NEVER): Promise<boolean> {
    return firstValueFrom(
      this.db.getLocal$<MatchSyncState>(docId(matchId)).pipe(
        map((doc) => (doc ? (doc.toJSON().data as MatchSyncState).status : null)),
        filter((status) => status === "synced"),
        map(() => true),
        timeout({ first: timeoutMs, with: () => of(false) }),
        takeUntil(cancel$)
      ),
      { defaultValue: false }
    );
  }
}
