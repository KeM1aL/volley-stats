import type { LocalDatabase } from "../collections";
import { map, type Observable } from "rxjs";
import type { ScorerInfo } from "./scorer-claim";

export type ClaimState = "held" | "pending-force" | "lost";

/** A match this device syncs (it opened it), shared by every tab. */
export interface TrackedMatch {
  userId: string;
  /** null: never claimed (e.g. seeded by the upgrade); pushes are not gated. */
  claim: ClaimState | null;
  lastOpenedAt: string;
  lostTo: ScorerInfo | null;
}

export type TrackedMatchMap = Record<string, TrackedMatch>;

/** A match leaves the list this long after it was last opened, once nothing is unsent. */
export const TRACKED_MATCH_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const DOC_ID = "tracked-matches";
type TrackedDoc = { matches: TrackedMatchMap };

export class TrackedMatches {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: LocalDatabase) {}

  async get(): Promise<TrackedMatchMap> {
    const doc = await this.db.getLocal<TrackedDoc>(DOC_ID);
    return doc ? { ...doc.toJSON().data.matches } : {};
  }

  get$(): Observable<TrackedMatchMap> {
    return this.db.getLocal$<TrackedDoc>(DOC_ID).pipe(map((doc) => (doc ? { ...doc.toJSON().data.matches } : {})));
  }

  async entry(matchId: string): Promise<TrackedMatch | null> {
    return (await this.get())[matchId] ?? null;
  }

  track(matchId: string, userId: string, now: string = new Date().toISOString()): Promise<void> {
    return this.modify((matches) => {
      const previous = matches[matchId];
      const sameUser = previous?.userId === userId;
      return {
        ...matches,
        [matchId]: {
          userId,
          claim: sameUser ? previous.claim : null,
          lostTo: sameUser ? previous.lostTo : null,
          lastOpenedAt: now,
        },
      };
    });
  }

  setClaim(matchId: string, claim: ClaimState, lostTo: ScorerInfo | null = null): Promise<void> {
    return this.modify((matches) =>
      matches[matchId] ? { ...matches, [matchId]: { ...matches[matchId], claim, lostTo } } : matches
    );
  }

  remove(matchId: string): Promise<void> {
    return this.modify((matches) => {
      const { [matchId]: _removed, ...rest } = matches;
      return rest;
    });
  }

  /** Read-modify-write, serialized within this tab. */
  private modify(change: (matches: TrackedMatchMap) => TrackedMatchMap): Promise<void> {
    const run = async () => {
      const doc = await this.db.getLocal<TrackedDoc>(DOC_ID);
      if (!doc) {
        await this.db.upsertLocal<TrackedDoc>(DOC_ID, { matches: change({}) });
        return;
      }
      await doc.incrementalModify((data: TrackedDoc) => ({ ...data, matches: change({ ...data.matches }) }));
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
