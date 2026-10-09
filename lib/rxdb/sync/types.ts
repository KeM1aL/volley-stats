import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxCollection, WithDeleted } from "rxdb";
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

/** Pull checkpoint: the server-only `_modified` column, then the id. */
export type SupabaseCheckpoint = { id: string; modified: string };

/** What the sync layer needs to know about the signed-in user. */
export interface SyncUser {
  id: string;
  teamIds: string[];
  clubIds: string[];
}

/** What the push handler does with one row before sending it. */
export type GateDecision =
  | { kind: "send" }
  | { kind: "wait"; reason: "claim" | "parents" }
  | { kind: "reject"; error: ClassifiedError }
  | { kind: "supersede" };

export interface PushGate {
  check(doc: WithDeleted<any>): Promise<GateDecision>;
}

export interface PushReporter {
  rejected(doc: WithDeleted<any>, error: ClassifiedError, opts: { neverUploaded: boolean }): Promise<void>;
  superseded(doc: WithDeleted<any>): Promise<void>;
  /** Called for failures that count towards MAX_TEMPORARY_ATTEMPTS; returns the attempts so far. */
  temporaryFailure(doc: WithDeleted<any>, error: ClassifiedError): Promise<number>;
  neverUploaded(docId: string): Promise<boolean>;
  /** Whether this device has a pending_changes entry for the row (none: a copy left by an older version). */
  hasPendingEntry(docId: string): Promise<boolean>;
}

export interface SupabaseReplicationOptions {
  replicationIdentifier: string;
  collection: RxCollection<any>;
  client: SupabaseClient<any>;
  tableName: string;
  /** Sent as x-device-id on every request (match tables). */
  deviceId?: string;
  live?: boolean;
  retryTime?: number;
  waitForLeadership?: boolean;
  autoStart?: boolean;
  pull?: { batchSize?: number; queryBuilder?: (query: any) => any };
  push?: {
    batchSize?: number;
    modifier?: (doc: WithDeleted<any>) => WithDeleted<any> | null;
    gate?: PushGate;
    reporter?: PushReporter;
  };
}
