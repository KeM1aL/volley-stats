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

/** Short stable key of a filter, so a different filter starts from a fresh checkpoint. */
export function filterKey(values: readonly string[]): string {
  let hash = 5381;
  for (const char of [...values].sort().join(",")) hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

/** Pull-only replications of the reference tables (edited online through the API layer). */
export class ReferenceSync {
  private states: RxReplicationState<any, SupabaseCheckpoint>[] = [];

  constructor(private readonly deps: ReferenceSyncDeps) {}

  start(user: SyncUser): void {
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

  reSync(): void {
    for (const state of this.states) state.reSync();
  }

  async stop(): Promise<void> {
    const states = this.states;
    this.states = [];
    await Promise.all(states.map((state) => state.cancel()));
  }
}
