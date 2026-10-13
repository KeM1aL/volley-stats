import type { PlayerStat, ScorePoint } from "@/lib/types";
import { isPointStat } from "./roles";

export type Zone = "p1" | "p2" | "p3" | "p4" | "p5" | "p6";
export const ZONES: Zone[] = ["p1", "p2", "p3", "p4", "p5", "p6"];
export const FRONT_ROW: Zone[] = ["p2", "p3", "p4"];

export interface ZoneCount {
  points: number;
  errors: number;
}

export interface ZoneSummary {
  zones: Record<Zone, ZoneCount>;
  frontRow: ZoneCount;
  backRow: ZoneCount;
  /** Points and errors with no known position (e.g. the libero). */
  unplaced: number;
}

export function lineupByZone(lineup: Record<string, string | undefined> | null | undefined): Partial<Record<Zone, string>> {
  return Object.fromEntries(ZONES.flatMap((zone) => (lineup?.[zone] ? [[zone, lineup[zone] as string]] : [])));
}

export function zoneSummary(stats: PlayerStat[], points: ScorePoint[]): ZoneSummary {
  const zones = Object.fromEntries(ZONES.map((zone) => [zone, { points: 0, errors: 0 }])) as Record<Zone, ZoneCount>;
  const pointByStat = new Map(points.filter((p) => p.player_stat_id).map((p) => [p.player_stat_id as string, p]));
  let unplaced = 0;
  for (const s of stats) {
    const isPoint = isPointStat(s);
    if (!isPoint && s.result !== "error") continue;
    const zone = (ZONES.includes(s.position as Zone) ? (s.position as Zone) : null) ?? zoneInRotation(pointByStat.get(s.id), s.player_id);
    if (!zone) {
      unplaced++;
      continue;
    }
    if (isPoint) zones[zone].points++;
    else zones[zone].errors++;
  }
  const sum = (list: Zone[]): ZoneCount =>
    list.reduce((acc, zone) => ({ points: acc.points + zones[zone].points, errors: acc.errors + zones[zone].errors }), { points: 0, errors: 0 });
  return { zones, frontRow: sum(FRONT_ROW), backRow: sum(ZONES.filter((zone) => !FRONT_ROW.includes(zone))), unplaced };
}

function zoneInRotation(point: ScorePoint | undefined, playerId: string): Zone | null {
  if (!point) return null;
  const entry = Object.entries(point.current_rotation ?? {}).find(([, id]) => id === playerId);
  return entry && ZONES.includes(entry[0] as Zone) ? (entry[0] as Zone) : null;
}
