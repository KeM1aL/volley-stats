import type { WithDeleted } from "rxdb";
import type { ParentRef, PendingChanges } from "./pending-changes";
import type { GateDecision, MatchCollectionName, PushGate } from "./types";

/**
 * Foreign keys between match tables (spec, "Verification findings").
 * `score_points.player_stat_id` has no foreign key, so a point never waits for its stat.
 */
export const PARENT_FIELDS: Record<MatchCollectionName, ReadonlyArray<{ field: string; table: MatchCollectionName }>> = {
  matches: [],
  sets: [{ field: "match_id", table: "matches" }],
  player_stats: [
    { field: "match_id", table: "matches" },
    { field: "set_id", table: "sets" },
  ],
  score_points: [
    { field: "match_id", table: "matches" },
    { field: "set_id", table: "sets" },
  ],
  events: [
    { field: "match_id", table: "matches" },
    { field: "set_id", table: "sets" },
  ],
};

/** How long a row waits in the handler for a parent uploading through another replication. */
export const PARENT_WAIT_MS = 5000;

export function parentRefs(table: MatchCollectionName, doc: Record<string, unknown>): ParentRef[] {
  return PARENT_FIELDS[table]
    .map(({ field, table: parentTable }) => ({ table: parentTable, docId: doc[field] }))
    .filter((ref): ref is ParentRef => typeof ref.docId === "string" && ref.docId.length > 0);
}

/**
 * The device's right to push this match: "ok" (claimed, or never claimed),
 * "lost" (another device took over), "unavailable" (an offline claim that
 * can't be confirmed yet).
 */
export type ClaimCheck = (matchId: string) => Promise<"ok" | "lost" | "unavailable">;

export interface PushGateOptions {
  table: MatchCollectionName;
  matchId: string;
  pending: PendingChanges;
  claim: ClaimCheck;
  waitMs?: number;
}

export function createPushGate({ table, matchId, pending, claim, waitMs = PARENT_WAIT_MS }: PushGateOptions): PushGate {
  return {
    async check(doc: WithDeleted<any>): Promise<GateDecision> {
      const claimState = await claim(matchId);
      if (claimState === "lost") return { kind: "supersede" };
      if (claimState === "unavailable") return { kind: "wait", reason: "claim" };

      const refs = parentRefs(table, doc);
      let status = await pending.parentStatus(refs);
      if (status.kind === "pending") {
        await pending.waitUntilSettled(status.refs, waitMs);
        status = await pending.parentStatus(refs);
      }
      switch (status.kind) {
        case "none":
          return { kind: "send" };
        case "pending":
          return { kind: "wait", reason: "parents" };
        case "superseded":
          return { kind: "supersede" };
        case "rejected":
          return {
            kind: "reject",
            error: { kind: "permanent", code: "parent_rejected", params: { table: status.ref.table } },
          };
      }
    },
  };
}
