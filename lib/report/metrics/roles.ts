import type { PlayerRole } from "@/lib/enums";
import type { PlayerStat, Set } from "@/lib/types";

export type RoleKey = `${PlayerRole}` | "none";
export const ROLE_ORDER: RoleKey[] = ["outside_hitter", "opposite", "middle_hitter", "setter", "libero", "none"];

export interface RoleLine {
  role: RoleKey;
  points: number;
  errors: number;
  topScorerId: string | null;
  topScorerPoints: number;
}

/** An ace, kill or block point. */
export const isPointStat = (s: PlayerStat): boolean =>
  s.result === "success" && (s.stat_type === "serve" || s.stat_type === "spike" || s.stat_type === "block");

export function roleLines(stats: PlayerStat[], sets: Set[]): RoleLine[] {
  const rolesBySet = new Map(sets.map((set) => [set.id, set.player_roles ?? {}]));
  const byRole = new Map<RoleKey, { points: number; errors: number; scorers: Map<string, number> }>();
  for (const s of stats) {
    const isPoint = isPointStat(s);
    if (!isPoint && s.result !== "error") continue;
    const raw = rolesBySet.get(s.set_id)?.[s.player_id] as string | undefined;
    const role: RoleKey = raw && ROLE_ORDER.includes(raw as RoleKey) ? (raw as RoleKey) : "none";
    const entry = byRole.get(role) ?? { points: 0, errors: 0, scorers: new Map<string, number>() };
    byRole.set(role, entry);
    if (isPoint) {
      entry.points++;
      entry.scorers.set(s.player_id, (entry.scorers.get(s.player_id) ?? 0) + 1);
    } else {
      entry.errors++;
    }
  }
  return ROLE_ORDER.flatMap((role) => {
    const entry = byRole.get(role);
    if (!entry) return [];
    let topScorerId: string | null = null;
    let topScorerPoints = 0;
    for (const [playerId, points] of entry.scorers) {
      if (points > topScorerPoints || (points === topScorerPoints && topScorerId !== null && playerId < topScorerId)) {
        topScorerId = playerId;
        topScorerPoints = points;
      }
    }
    return [{ role, points: entry.points, errors: entry.errors, topScorerId, topScorerPoints }];
  });
}
