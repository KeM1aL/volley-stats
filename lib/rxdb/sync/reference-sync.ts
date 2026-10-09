import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { LocalDatabase } from "../collections";
import { replicateSupabase } from "./replication";
import type { ReferenceCollectionName, SupabaseCheckpoint, SyncUser } from "./types";

export interface ReferenceSyncDeps {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  waitForLeadership: boolean;
  retryTime: number;
}

/**
 * Short stable key of a filter, so a different filter starts from a fresh checkpoint. Two independent
 * 32-bit hashes (djb2 and FNV-1a) are combined, so a filter that collides in one still differs in the other.
 */
export function filterKey(values: readonly string[]): string {
  let djb2 = 5381;
  let fnv1a = 0x811c9dc5;
  for (const char of [...values].sort().join(",")) {
    const code = char.charCodeAt(0);
    djb2 = ((djb2 << 5) + djb2 + code) | 0;
    fnv1a = Math.imul(fnv1a ^ code, 0x01000193);
  }
  return `${(djb2 >>> 0).toString(36)}${(fnv1a >>> 0).toString(36)}`;
}

/** Pull-only replications of the reference tables (edited online through the API layer). */
export class ReferenceSync {
  private states: RxReplicationState<any, SupabaseCheckpoint>[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: ReferenceSyncDeps) {}

  /** Stops the replications of an earlier call first, then starts those of this user. Calls run one after the other. */
  start(user: SyncUser): Promise<void> {
    return this.serialize(async () => {
      await this.cancelStates();
      this.startStates(user);
    });
  }

  reSync(): void {
    for (const state of this.states) state.reSync();
  }

  stop(): Promise<void> {
    return this.serialize(() => this.cancelStates());
  }

  private serialize(task: () => Promise<void>): Promise<void> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private startStates(user: SyncUser): void {
    const plan: Array<{ table: ReferenceCollectionName; values: string[]; filter?: (query: any) => any }> = [
      { table: "championships", values: [] },
      { table: "seasons", values: [] },
      { table: "match_formats", values: [] },
      { table: "clubs", values: [] },
      { table: "teams", values: [] },
    ];
    if (user.clubIds.length > 0) {
      plan.push({ table: "club_members", values: user.clubIds, filter: (query) => query.in("club_id", user.clubIds) });
    }
    if (user.teamIds.length > 0) {
      plan.push({ table: "team_members", values: user.teamIds, filter: (query) => query.in("team_id", user.teamIds) });
    }
    this.states = plan.map(({ table, values, filter }) =>
      replicateSupabase({
        replicationIdentifier: `sync2_${table}_${user.id}_${filterKey(values)}`,
        collection: this.deps.db[table] as any,
        client: this.deps.client,
        tableName: table,
        live: true,
        retryTime: this.deps.retryTime,
        waitForLeadership: this.deps.waitForLeadership,
        pull: { queryBuilder: filter },
      })
    );
  }

  private async cancelStates(): Promise<void> {
    const states = this.states;
    this.states = [];
    await Promise.all(states.map((state) => state.cancel()));
  }
}
