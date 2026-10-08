
import type { SupabaseClient } from '@supabase/supabase-js';
import { ReplicationOptions, ReplicationPullOptions, ReplicationPushOptions } from 'rxdb';
import type { WithDeleted } from "rxdb";
import type { ClassifiedError } from "./errors";

/** Tables replicated per match; pushes and pending changes only concern these. */
export const MATCH_COLLECTIONS = ["matches", "sets", "player_stats", "score_points", "events"] as const;
export type MatchCollectionName = (typeof MATCH_COLLECTIONS)[number];

/** Tables that are only pulled (edited online through the API layer). */
export const REFERENCE_COLLECTIONS = [
  "championships",
  "seasons",
  "match_formats",
  "clubs",
  "teams",
  "club_members",
  "team_members",
] as const;
export type ReferenceCollectionName = (typeof REFERENCE_COLLECTIONS)[number];

/** What the sync layer needs to know about the signed-in user. */
export interface SyncUser {
  id: string;
  teamIds: string[];
  clubIds: string[];
}

export type SupabasePullQueryBuilderParams = {
    query: ReturnType<SupabaseClient['from']>['select'] extends (
        ...args: any[]
    ) => infer R
        ? R
        : never;
    lastPulledCheckpoint: SupabaseCheckpoint | undefined;
    batchSize: number;
};

export type SupabasePullQueryBuilder<RxDocType> = (
    params: SupabasePullQueryBuilderParams
) => SupabasePullQueryBuilderParams['query'] | void;

export type SyncOptionsSupabase<RxDocType> = Omit<
    ReplicationOptions<RxDocType, SupabaseCheckpoint>,
    'pull' | 'push'
> & {
    client: SupabaseClient;
    tableName: string;

    /**
     * Modified field, default "_modified"
     */
    modifiedField?: '_modified' | string;

    pull?: Omit<ReplicationPullOptions<RxDocType, SupabaseCheckpoint>, 'handler' | 'stream$'> & {
        /**
         * Allows modifying the PostgREST query before RxDB fetches remote changes.
         * You can return a new builder instance or mutate the provided one.
         */
        queryBuilder?: SupabasePullQueryBuilder<RxDocType>;
        
        /**
         * Allows modifying the live filter string used in the realtime subscription.
         */
        liveFilter?: string;
    };
    push?: Omit<ReplicationPushOptions<RxDocType>, 'handler'>;
};

export type SupabaseCheckpoint = {
    id: string;
    modified: string;
}

export interface SyncStateDocument {
  matchId: string;
  lastSyncTime: number;  // Client timestamp when replication completed
  collections: {
    matches: { lastUpdatedAt: string; hasSynced: boolean };  // Server timestamp + sync completion flag
    sets: { lastUpdatedAt: string; hasSynced: boolean };
    score_points: { lastUpdatedAt: string; hasSynced: boolean };
    player_stats: { lastUpdatedAt: string; hasSynced: boolean };
    events: { lastUpdatedAt: string; hasSynced: boolean };
  };
  status: 'never-synced' | 'syncing' | 'synced' | 'error';
  lastError?: string;
  lastErrorTime?: number;
}

export type DynamicCollectionName = 'matches' | 'sets' | 'score_points' | 'player_stats' | 'events';

/** What the push handler does with one row before sending it. */
export type GateDecision =
  | { kind: "send" }
  | { kind: "wait"; reason: "claim" | "parents" }
  | { kind: "reject"; error: ClassifiedError }
  | { kind: "supersede" };

export interface PushGate {
  check(doc: WithDeleted<any>): Promise<GateDecision>;
}
