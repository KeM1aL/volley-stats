import type { Match, User as AuthUser } from "@/lib/types";

/** Who sees the start, edit and statistics actions: the creator of either team, or a member of either team or its club. */
export function canManageMatch(user: AuthUser | null, match: Match): boolean {
  if (!user) return false;

  if (match.home_team?.user_id === user.id || match.away_team?.user_id === user.id) return true;

  const isHomeTeamMember = user.teamMembers?.some((member) => member.team_id === match.home_team_id);
  const isAwayTeamMember = user.teamMembers?.some((member) => member.team_id === match.away_team_id);
  const isHomeClubMember = user.clubMembers?.some((member) => member.club_id === match.home_team?.club_id);
  const isAwayClubMember = user.clubMembers?.some((member) => member.club_id === match.away_team?.club_id);

  return !!(isHomeTeamMember || isAwayTeamMember || isHomeClubMember || isAwayClubMember);
}

/** Who may archive, restore or delete the match: the creator of either team (the RLS update/delete rule). */
export function canRemoveMatch(user: AuthUser | null, match: Match): boolean {
  if (!user) return false;
  return match.home_team?.user_id === user.id || match.away_team?.user_id === user.id;
}
