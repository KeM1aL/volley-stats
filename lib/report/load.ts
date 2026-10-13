import type { SupabaseClient } from "@supabase/supabase-js";
import { isoToMicros } from "@/lib/rxdb/sync/timestamps";
import type { Event, Match, MatchFormat, PlayerStat, ScorePoint, Set as MatchSet, Team, TeamMember } from "@/lib/types";
import { live, rows, type Row } from "./query";
import type { MatchReportData } from "./types";

export class ReportNotFoundError extends Error {
  constructor() {
    super("matchNotFound");
  }
}

export interface LoadedReport {
  data: MatchReportData;
  /** Latest `_modified` of every row read, deleted ones included (a deletion changes the report). */
  lastModified: string;
}

export async function loadMatchReportData(supabase: SupabaseClient, matchId: string): Promise<LoadedReport> {
  const matchRows = await rows(supabase.from("matches").select("*").eq("id", matchId));
  const match = live(matchRows)[0];
  if (!match) throw new ReportNotFoundError();
  const teamIds = [match.home_team_id, match.away_team_id];
  const [formats, teams, championships, members, sets, points, stats, events] = await Promise.all([
    rows(supabase.from("match_formats").select("*").eq("id", match.match_format_id)),
    rows(supabase.from("teams").select("*").in("id", teamIds)),
    match.championship_id ? rows(supabase.from("championships").select("*").eq("id", match.championship_id)) : Promise.resolve([] as Row[]),
    rows(supabase.from("team_members").select("*").in("team_id", teamIds)),
    rows(supabase.from("sets").select("*").eq("match_id", matchId)),
    rows(supabase.from("score_points").select("*").eq("match_id", matchId)),
    rows(supabase.from("player_stats").select("*").eq("match_id", matchId)),
    rows(supabase.from("events").select("*").eq("match_id", matchId)),
  ]);
  const format = formats[0];
  const homeTeam = teams.find((team) => team.id === match.home_team_id);
  const awayTeam = teams.find((team) => team.id === match.away_team_id);
  if (!format || !homeTeam || !awayTeam) throw new Error("matchDataIncomplete");

  const liveSets = live(sets);
  const livePoints = live(points);
  const liveStats = live(stats);
  const liveEvents = live(events);
  const referenced = referencedPlayerIds(liveSets, livePoints, liveStats, liveEvents);
  const keptMembers = members.filter((member) => member._deleted !== true || referenced.has(member.id));

  return {
    data: {
      match: match as Match,
      format: format as MatchFormat,
      homeTeam: homeTeam as Team,
      awayTeam: awayTeam as Team,
      championshipName: live(championships)[0]?.name ?? null,
      members: keptMembers as TeamMember[],
      sets: liveSets as MatchSet[],
      points: livePoints as ScorePoint[],
      stats: liveStats as PlayerStat[],
      events: liveEvents as Event[],
    },
    lastModified: latestModified([...matchRows, ...formats, ...teams, ...championships, ...members, ...sets, ...points, ...stats, ...events]),
  };
}

function referencedPlayerIds(sets: Row[], points: Row[], stats: Row[], events: Row[]): Set<string> {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value) ids.add(value);
  };
  for (const set of sets) {
    Object.values(set.first_lineup ?? {}).forEach(add);
    Object.values(set.current_lineup ?? {}).forEach(add);
    Object.keys(set.player_roles ?? {}).forEach(add);
  }
  for (const point of points) {
    add(point.player_id);
    Object.values(point.current_rotation ?? {}).forEach(add);
  }
  for (const stat of stats) add(stat.player_id);
  for (const event of events) {
    add(event.player_id);
    add(event.details?.player_in_id);
    add(event.details?.player_out_id);
  }
  return ids;
}

function latestModified(list: Row[]): string {
  let best: { micros: number; value: string } | null = null;
  for (const row of list) {
    const micros = isoToMicros(row._modified);
    if (micros !== null && (!best || micros > best.micros)) best = { micros, value: row._modified };
  }
  return best?.value ?? "";
}
