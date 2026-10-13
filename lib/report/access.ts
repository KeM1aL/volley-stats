import type { SupabaseClient } from "@supabase/supabase-js";
import { live, rows } from "./query";

export type ReportAccess = "allowed" | "match-not-found" | "team-not-in-match" | "forbidden";

/**
 * Whether `userId` may export the report of `matchId` analysed for `teamId`: a member of the team,
 * its creator, or an owner/admin of its club. Runs with the caller's own client, before any match data is read.
 */
export async function checkReportAccess(supabase: SupabaseClient, userId: string, matchId: string, teamId: string): Promise<ReportAccess> {
  const match = live(await rows(supabase.from("matches").select("id, home_team_id, away_team_id, _deleted").eq("id", matchId)))[0];
  if (!match) return "match-not-found";
  if (teamId !== match.home_team_id && teamId !== match.away_team_id) return "team-not-in-match";

  const memberships = live(await rows(supabase.from("team_members").select("id, _deleted").eq("team_id", teamId).eq("user_id", userId)));
  if (memberships.length > 0) return "allowed";

  const team = live(await rows(supabase.from("teams").select("id, user_id, club_id, _deleted").eq("id", teamId)))[0];
  if (!team) return "forbidden";
  if (team.user_id === userId) return "allowed";
  if (!team.club_id) return "forbidden";

  const clubRoles = live(await rows(supabase.from("club_members").select("role, _deleted").eq("club_id", team.club_id).eq("user_id", userId)));
  return clubRoles.some((member) => member.role === "owner" || member.role === "admin") ? "allowed" : "forbidden";
}
