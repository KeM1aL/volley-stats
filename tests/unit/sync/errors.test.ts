import { describe, expect, it } from "vitest";
import { classifyPushError, countsTowardsAttemptLimit, referencedTable } from "@/lib/rxdb/sync/errors";

describe("classifyPushError", () => {
  it.each([
    [{ code: "", message: "TypeError: Failed to fetch" }, 0, "temporary", "network"],
    [{ code: "20", message: "AbortError: The operation was aborted." }, 0, "temporary", "network"],
    [{ code: "", message: "Request Timeout" }, 408, "temporary", "network"],
    [{ code: "PGRST303", message: "JWT expired" }, 401, "temporary", "auth"],
    [{ code: "PGRST301", message: "JWSError" }, 401, "temporary", "auth"],
    // The anon key after a failed token refresh: PostgREST answers 401 with the RLS code.
    [{ code: "42501", message: "rls" }, 401, "temporary", "auth"],
    [{ code: "", message: "Service Unavailable" }, 503, "temporary", "server"],
    [{ code: "", message: "Too Many Requests" }, 429, "temporary", "server"],
    [{ code: "23503", message: "fk", details: 'Key (set_id)=(x) is not present in table "sets".' }, 409, "temporary", "parent_missing"],
    [{ code: "23503", message: "fk", details: 'Key (match_id)=(x) is not present in table "matches".' }, 409, "temporary", "parent_missing"],
    [{ code: "23503", message: "fk", details: 'Key (player_id)=(x) is not present in table "team_members".' }, 409, "permanent", "reference_missing"],
    [{ code: "P0001", message: "scorer_mismatch" }, 400, "superseded", "scorer_mismatch"],
    [{ code: "42501", message: "rls" }, 403, "permanent", "rls"],
    [{ code: "PGRST204", message: "column" }, 400, "permanent", "schema_mismatch"],
    [{ code: "42703", message: "column" }, 400, "permanent", "schema_mismatch"],
    [{ code: "23514", message: "check" }, 400, "permanent", "invalid_data"],
    [{ code: "23502", message: "not null" }, 400, "permanent", "invalid_data"],
    [{ code: "22P02", message: "invalid uuid" }, 400, "permanent", "invalid_data"],
    [{ code: "23505", message: "duplicate" }, 409, "permanent", "duplicate"],
    [{ code: "row_missing", message: "row_missing" }, 404, "permanent", "deleted_on_server"],
    [{ code: "XX000", message: "internal" }, 400, "temporary", "unknown"],
  ] as const)("%o with status %i is %s/%s", (error, status, kind, code) => {
    expect(classifyPushError(error, status)).toMatchObject({ kind, code });
  });

  it("names the missing external table", () => {
    const result = classifyPushError(
      { code: "23503", message: "fk", details: 'Key (player_id)=(x) is not present in table "team_members".' },
      409
    );
    expect(result.params).toEqual({ table: "team_members" });
  });
});

describe("countsTowardsAttemptLimit", () => {
  it("only counts errors that connectivity can't explain", () => {
    expect(countsTowardsAttemptLimit("parent_missing")).toBe(true);
    expect(countsTowardsAttemptLimit("unknown")).toBe(true);
    expect(countsTowardsAttemptLimit("network")).toBe(false);
    expect(countsTowardsAttemptLimit("auth")).toBe(false);
    expect(countsTowardsAttemptLimit("server")).toBe(false);
  });
});

describe("referencedTable", () => {
  it("reads the table from Postgres' FK details", () => {
    expect(referencedTable('Key (set_id)=(1) is not present in table "sets".')).toBe("sets");
    expect(referencedTable(null)).toBeNull();
  });
});
