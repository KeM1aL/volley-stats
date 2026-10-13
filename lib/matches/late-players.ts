import type { TeamMember } from "@/lib/types";

/** Team members who can join a match in progress: not archived and not in the roster yet, by jersey number. */
export function latePlayerCandidates(members: readonly TeamMember[], rosterIds: readonly string[]): TeamMember[] {
  const roster = new Set(rosterIds);
  return members
    .filter((member) => !member.archived_at && !roster.has(member.id))
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

/** The roster with `playerId` in it once (a new array). */
export function withLatePlayer(roster: readonly string[] | null | undefined, playerId: string): string[] {
  const current = [...(roster ?? [])];
  return current.includes(playerId) ? current : [...current, playerId];
}
