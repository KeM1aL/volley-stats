import type { MatchReportData, Rally, Side, StatAction, WinOrigin } from "../types";
import { ZONES, type Zone } from "./zones";

/**
 * Every rally of the match in order, from the managed team's point of view.
 * The origin comes from `scoring_team_id` and `action_team_id` only: for points entered
 * without a player, the app stores `result` from the managed team's point of view
 * (an opponent error is `action_team_id` = opponent with `result` = success).
 */
export function buildRallies(data: MatchReportData, managedTeamId: string): Rally[] {
  const usIsHome = data.match.home_team_id === managedTeamId;
  const sets = [...data.sets].sort((a, b) => a.set_number - b.set_number);
  const result: Rally[] = [];
  for (const set of sets) {
    const points = data.points
      .filter((point) => point.set_id === set.id)
      .sort((a, b) => a.point_number - b.point_number || Date.parse(a.timestamp) - Date.parse(b.timestamp));
    let server: Side = set.first_server_team_id === managedTeamId ? "us" : "them";
    points.forEach((point, position) => {
      const winner: Side = point.scoring_team_id === managedTeamId ? "us" : "them";
      const actedByUs = point.action_team_id === managedTeamId;
      const typed = point.point_type !== "unknown";
      const action = actedByUs && typed ? (point.point_type as StatAction) : null;
      const rotation = point.current_rotation ?? {};
      result.push({
        setId: set.id,
        setNumber: set.set_number,
        index: position + 1,
        winner,
        server,
        serverPlayerId: server === "us" && data.format.rotation ? (rotation.p1 ?? null) : null,
        onCourt: Object.values(rotation).filter((id): id is string => typeof id === "string" && id.length > 0),
        positions: Object.fromEntries(
          Object.entries(rotation).flatMap(([position, id]) => (typeof id === "string" && id && ZONES.includes(position as Zone) ? [[id, position as Zone]] : []))
        ),
        score: usIsHome ? { us: point.home_score, them: point.away_score } : { us: point.away_score, them: point.home_score },
        winOrigin: winner === "us" ? winOrigin(actedByUs, action) : null,
        lossOrigin: winner === "them" ? (actedByUs ? "ownError" : "opponentWinner") : null,
        action,
        typed,
        timestamp: point.timestamp,
      });
      server = winner;
    });
  }
  return result;
}

function winOrigin(actedByUs: boolean, action: StatAction | null): WinOrigin {
  if (!actedByUs) return "opponentError";
  switch (action) {
    case "serve":
      return "ace";
    case "spike":
      return "kill";
    case "block":
      return "block";
    case "reception":
    case "defense":
      return "otherWinner";
    default:
      return "unspecified";
  }
}
