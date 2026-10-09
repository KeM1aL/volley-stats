import type { PendingChange } from "./pending-changes";
import type { ScorerInfo } from "./scorer-claim";
import type { TrackedMatchMap } from "./tracked-matches";

export type SyncBadgeState = "saved" | "uploading" | "waiting" | "problem" | "other-account";

export interface SyncReasonInfo {
  code: string;
  params: Record<string, string>;
}

/**
 * Translation keys (namespace "sync") that explain a reason. A code or table the messages don't know
 * (an older app showing a newer entry) falls back to `errors.unknown` / `tables.unknown`.
 */
export function reasonKeys(reason: SyncReasonInfo, has: (key: string) => boolean): { message: string; table: string } {
  const message = `errors.${reason.code}`;
  const table = reason.params.table ? `tables.${reason.params.table}` : "";
  return {
    message: has(message) ? message : "errors.unknown",
    table: table && has(table) ? table : "tables.unknown",
  };
}

export interface MatchSyncSummary {
  matchId: string;
  pending: number;
  rejected: number;
  superseded: number;
  otherAccount: boolean;
  reasons: SyncReasonInfo[];
  lostTo: ScorerInfo | null;
}

export interface SyncStatus {
  state: SyncBadgeState;
  pendingCount: number;
  rejectedCount: number;
  supersededCount: number;
  otherAccountCount: number;
  matches: MatchSyncSummary[];
}

export interface SyncStatusInput {
  entries: PendingChange[];
  tracked: TrackedMatchMap;
  /** null when signed out: everything on the device counts as the device's own. */
  userId: string | null;
  online: boolean;
}

/** The badge state (spec section 8). Superseded changes are information, never a problem. */
export function deriveSyncStatus({ entries, tracked, userId, online }: SyncStatusInput): SyncStatus {
  const summaries = new Map<string, MatchSyncSummary>();
  const counts = { pending: 0, rejected: 0, superseded: 0, otherAccount: 0 };

  for (const entry of entries) {
    let summary = summaries.get(entry.match_id);
    if (!summary) {
      summary = {
        matchId: entry.match_id,
        pending: 0,
        rejected: 0,
        superseded: 0,
        otherAccount: false,
        reasons: [],
        lostTo: tracked[entry.match_id]?.lostTo ?? null,
      };
      summaries.set(entry.match_id, summary);
    }
    if (entry.status === "superseded") {
      counts.superseded += 1;
      summary.superseded += 1;
      continue;
    }
    const owner = tracked[entry.match_id]?.userId;
    if (userId !== null && owner !== undefined && owner !== userId) {
      counts.otherAccount += 1;
      summary.otherAccount = true;
      continue;
    }
    if (entry.status === "pending") {
      counts.pending += 1;
      summary.pending += 1;
      continue;
    }
    counts.rejected += 1;
    summary.rejected += 1;
    const reason = { code: entry.error_code ?? "unknown", params: entry.error_params ?? {} };
    const known = summary.reasons.some(
      (existing) => existing.code === reason.code && JSON.stringify(existing.params) === JSON.stringify(reason.params)
    );
    if (!known) summary.reasons.push(reason);
  }

  const state: SyncBadgeState =
    counts.rejected > 0
      ? "problem"
      : counts.otherAccount > 0
        ? "other-account"
        : counts.pending > 0
          ? online
            ? "uploading"
            : "waiting"
          : "saved";

  return {
    state,
    pendingCount: counts.pending,
    rejectedCount: counts.rejected,
    supersededCount: counts.superseded,
    otherAccountCount: counts.otherAccount,
    matches: [...summaries.values()],
  };
}
