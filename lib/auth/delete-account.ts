// Account deletion: the decisions the leaving user makes for the teams they created, and the
// RPC's answer. Pure logic; the dialog and the network call are in components/settings/delete-account-card.tsx.

export interface OwnedTeam {
  id: string;
  name: string;
}

export interface Candidate {
  teamId: string;
  userId: string;
  name: string;
}

export type TeamChoice = { action: "delete" } | { action: "transfer"; newOwner: string };

export interface TeamToDecide {
  team: OwnedTeam;
  candidates: { userId: string; name: string }[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Teams the user created, each with the members who could take it over (linked account, not archived, not deleted, not the user), sorted by name. */
export function teamsToDecide(
  teams: OwnedTeam[],
  members: { team_id: string; user_id: string | null; name: string; archived_at: string | null; _deleted: boolean }[],
  userId: string
): TeamToDecide[] {
  return [...teams].sort(byName).map((team) => {
    const seen = new Set<string>();
    const candidates: { userId: string; name: string }[] = [];
    for (const m of members) {
      if (m.team_id !== team.id || !m.user_id || m.user_id === userId || m.archived_at !== null || m._deleted) continue;
      if (seen.has(m.user_id)) continue;
      seen.add(m.user_id);
      candidates.push({ userId: m.user_id, name: m.name });
    }
    return { team, candidates: candidates.sort(byName) };
  });
}

/** The RPC payload; null while a team has no choice yet. */
export function buildDecisions(
  teams: TeamToDecide[],
  choices: Record<string, TeamChoice | undefined>
): { team_id: string; action: "delete" | "transfer"; new_owner: string | null }[] | null {
  const decisions: { team_id: string; action: "delete" | "transfer"; new_owner: string | null }[] = [];
  for (const { team } of teams) {
    const choice = choices[team.id];
    if (!choice) return null;
    decisions.push({
      team_id: team.id,
      action: choice.action,
      new_owner: choice.action === "transfer" ? choice.newOwner : null,
    });
  }
  return decisions;
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: "invalid_decisions" | "invalid_new_owner" | "failed"; message: string };

export function parseDeleteAccountError(error: { message?: string } | null): DeleteAccountResult {
  if (!error) return { ok: true };
  const message = error.message ?? "";
  if (message === "invalid_decisions" || message === "invalid_new_owner") return { ok: false, reason: message, message };
  return { ok: false, reason: "failed", message };
}
