import type { ClubMember, Team, TeamMember } from "@/lib/types";

export interface ExportUser {
  id: string;
  teamMembers?: TeamMember[];
  clubMembers?: ClubMember[];
}

/**
 * Client-side copy of `checkReportAccess`, to show the export button. The route remains the authority.
 * `user.teamMembers` also holds one entry per team of each of the user's clubs (lib/api/users.ts),
 * whose `id` is the team id; those are not team memberships.
 */
export function canExportForTeam(
  user: ExportUser | null | undefined,
  team: Pick<Team, "id" | "user_id" | "club_id"> | null | undefined
): boolean {
  if (!user || !team) return false;
  if (team.user_id === user.id) return true;
  const isMember = (user.teamMembers ?? []).some(
    (m) =>
      m.team_id === team.id &&
      m.id !== m.team_id &&
      (m as { _deleted?: boolean })._deleted !== true &&
      !m.archived_at
  );
  if (isMember) return true;
  return !!team.club_id && (user.clubMembers ?? []).some((m) => m.club_id === team.club_id && (m.role === "owner" || m.role === "admin"));
}
