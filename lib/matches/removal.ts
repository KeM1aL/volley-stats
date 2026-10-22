import type { Match } from "@/lib/types";

export type MatchRemoval = "delete" | "archive";

/** "delete" for an upcoming match, "archive" otherwise. */
export function matchRemoval(match: Pick<Match, "status">): MatchRemoval {
  return match.status === "upcoming" ? "delete" : "archive";
}

export type RemovalError = "started" | "notFound" | "forbidden" | "unknown";

/**
 * Maps a Supabase/PostgREST error from delete_unstarted_match or the archive update.
 * PGRST116 is an update that RLS let through no row (the user may not change the match).
 */
export function removalError(error: unknown): RemovalError {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case "P0001":
      return "started";
    case "P0002":
      return "notFound";
    case "42501":
    case "PGRST116":
      return "forbidden";
    default:
      return "unknown";
  }
}
