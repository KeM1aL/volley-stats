export type SyncErrorKind = "temporary" | "permanent" | "superseded";
export type SyncErrorCode =
  | "network"
  | "auth"
  | "server"
  | "parent_missing"
  | "unknown"
  | "scorer_mismatch"
  | "rls"
  | "invalid_data"
  | "schema_mismatch"
  | "duplicate"
  | "reference_missing"
  | "deleted_on_server"
  | "parent_rejected"
  | "too_many_attempts";

export interface ClassifiedError {
  kind: SyncErrorKind;
  code: SyncErrorCode;
  params?: Record<string, string>;
}

/** The error object supabase-js returns (PostgrestError), or the adapter's own `row_missing`. */
export interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** After this many failures that connectivity can't explain, a row is rejected. */
export const MAX_TEMPORARY_ATTEMPTS = 20;

/** Tables of the same match: a missing parent there arrives through its own replication. */
const IN_MATCH_TABLES = new Set(["matches", "sets", "player_stats"]);

export function referencedTable(details: string | null | undefined): string | null {
  const match = /is not present in table "([^"]+)"/.exec(details ?? "");
  return match ? match[1] : null;
}

export function classifyPushError(error: PostgrestLikeError, status: number): ClassifiedError {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "P0001" && message === "scorer_mismatch") return { kind: "superseded", code: "scorer_mismatch" };
  if (code === "row_missing") return { kind: "permanent", code: "deleted_on_server" };
  if (code === "23503") {
    const table = referencedTable(error.details);
    if (table && IN_MATCH_TABLES.has(table)) return { kind: "temporary", code: "parent_missing", params: { table } };
    return { kind: "permanent", code: "reference_missing", params: { table: table ?? "unknown" } };
  }
  if (code === "42501") return { kind: "permanent", code: "rls" };
  if (code === "23505") return { kind: "permanent", code: "duplicate" };
  if (code === "42703" || code === "PGRST204") return { kind: "permanent", code: "schema_mismatch" };
  if (code === "23514" || code === "23502" || code.startsWith("22")) return { kind: "permanent", code: "invalid_data" };
  if (status === 401 || code === "PGRST301" || code === "PGRST303" || /jwt expired/i.test(message)) {
    return { kind: "temporary", code: "auth" };
  }
  if (status === 0 || status === 408) return { kind: "temporary", code: "network" };
  if (status === 429 || status >= 500) return { kind: "temporary", code: "server" };
  return { kind: "temporary", code: "unknown" };
}

/** Network, auth and server outages never turn into rejections, however long they last. */
export function countsTowardsAttemptLimit(code: SyncErrorCode): boolean {
  return code === "parent_missing" || code === "unknown";
}
