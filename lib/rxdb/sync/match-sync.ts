import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import { exhaustMap, filter, from, merge, Subject, type Subscription } from "rxjs";
import type { LocalDatabase } from "../collections";
import { createPushGate, type ClaimCheck } from "./dependencies";
import { matchIdOf, type PendingChanges } from "./pending-changes";
import { replicateSupabase } from "./replication";
import { MATCH_COLLECTIONS, type MatchCollectionName, type PushReporter, type SupabaseCheckpoint } from "./types";

export interface MatchSyncDeps {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  pending: PendingChanges;
  deviceId: string;
  claim: ClaimCheck;
  onSuperseded(matchId: string): Promise<void>;
  onSynced(matchId: string): Promise<void>;
  waitForLeadership: boolean;
  retryTime: number;
}

export const matchReplicationIdentifier = (table: MatchCollectionName, matchId: string): string =>
  `sync2_${table}_match_${matchId}`;

/** The five replications of one match (pull its rows, push this device's changes to them). */
export class MatchSync {
  private readonly states = new Map<MatchCollectionName, RxReplicationState<any, SupabaseCheckpoint>>();
  private subscriptions: Subscription[] = [];
  /** Per table: the settle check scheduled for when a kept pending entry passes its grace. */
  private readonly settleTimers = new Map<MatchCollectionName, ReturnType<typeof setTimeout>>();

  constructor(
    readonly matchId: string,
    private readonly deps: MatchSyncDeps
  ) {}

  start(): void {
    for (const table of MATCH_COLLECTIONS) {
      const field = table === "matches" ? "id" : "match_id";
      const state = replicateSupabase({
        replicationIdentifier: matchReplicationIdentifier(table, this.matchId),
        collection: this.deps.db[table] as any,
        client: this.deps.client,
        tableName: table,
        deviceId: this.deps.deviceId,
        live: true,
        retryTime: this.deps.retryTime,
        waitForLeadership: this.deps.waitForLeadership,
        pull: { queryBuilder: (query) => query.eq(field, this.matchId) },
        push: {
          // Each match's replication only pushes that match's rows.
          modifier: (doc) => (matchIdOf(table, doc) === this.matchId ? doc : null),
          gate: createPushGate({ table, matchId: this.matchId, pending: this.deps.pending, claim: this.deps.claim }),
          reporter: this.reporter(table),
        },
      });
      this.states.set(table, state);
      const settleAgain = new Subject<void>();
      this.subscriptions.push(
        state.sent$.subscribe((doc) => {
          this.deps.pending.onSent(table, doc as any).catch((error) => this.warn(table, "could not clear the pending entry", error));
        }),
        // Idle, or a kept entry's grace just ended (no replication activity may follow to trigger a check).
        merge(state.active$.pipe(filter((active) => !active)), settleAgain)
          .pipe(
            // Not switchMap: the promise below cannot be cancelled, so ignore idle signals while a check is running.
            exhaustMap(() => {
              const before = new Date().toISOString();
              return from(
                state
                  .awaitInSync()
                  .then(() => this.deps.pending.clearSettled(this.deps.db, this.matchId, table, before))
                  .then((graceEndsInMs) => this.scheduleSettleCheck(table, graceEndsInMs, settleAgain))
                  // Keep the error inside the inner stream so the outer subscription survives.
                  .catch((error) => this.warn(table, "settle check failed", error))
              );
            })
          )
          .subscribe(),
        state.error$.subscribe((error) => console.debug(`[sync] ${table} ${this.matchId}:`, error))
      );
    }
    void Promise.all([...this.states.values()].map((state) => state.awaitInitialReplication())).then(
      () => this.deps.onSynced(this.matchId).catch((error) => this.warn("match", "onSynced failed", error)),
      () => undefined
    );
  }

  reSync(): void {
    for (const state of this.states.values()) state.reSync();
  }

  async awaitInSync(): Promise<void> {
    await Promise.all([...this.states.values()].map((state) => state.awaitInSync()));
  }

  async cancel(): Promise<void> {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
    this.settleTimers.forEach((timer) => clearTimeout(timer));
    this.settleTimers.clear();
    const states = [...this.states.values()];
    this.states.clear();
    await Promise.all(states.map((state) => state.cancel()));
  }

  /** Checks the table again once a kept pending entry passes its grace (null: nothing kept). */
  private scheduleSettleCheck(table: MatchCollectionName, inMs: number | null, settleAgain: Subject<void>): void {
    clearTimeout(this.settleTimers.get(table));
    this.settleTimers.delete(table);
    if (inMs === null || this.subscriptions.length === 0) return;
    this.settleTimers.set(
      table,
      setTimeout(() => {
        this.settleTimers.delete(table);
        settleAgain.next();
      }, inMs + 1)
    );
  }

  private warn(scope: string, message: string, error: unknown): void {
    console.warn(`[sync] ${scope} ${this.matchId}: ${message}`, error);
  }

  private reporter(table: MatchCollectionName): PushReporter {
    const { pending, onSuperseded } = this.deps;
    return {
      rejected: (doc, error, opts) => pending.reject(table, doc, error, opts),
      superseded: async (doc) => {
        await pending.supersede(table, doc);
        await onSuperseded(this.matchId);
      },
      temporaryFailure: (doc) => pending.recordAttempt(table, doc),
      neverUploaded: (docId) => pending.isNeverUploaded(table, docId),
      createdHere: async (docId) => {
        const entry = await pending.get(table, docId);
        return !!entry && (entry.is_insert || entry.never_uploaded);
      },
    };
  }
}
