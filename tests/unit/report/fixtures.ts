import type { PlayerRole } from "@/lib/enums";
import type { MatchReportData } from "@/lib/report/types";
import type { Event, MatchFormat, PlayerStat, ScorePoint, Set, Team, TeamMember } from "@/lib/types";

export const MATCH_ID = "match-1";
export const US = "team-us";
export const THEM = "team-them";
export const P = { a: "p-a", b: "p-b", c: "p-c", d: "p-d", e: "p-e", f: "p-f", g: "p-g" } as const;
export const LINEUP: Set["first_lineup"] = { p1: P.a, p2: P.b, p3: P.c, p4: P.d, p5: P.e, p6: P.f };
const NAMES = ["Alice", "Bea", "Chloé", "Dana", "Emma", "Fanny", "Gina"];

export interface RallySpec {
  winner: "us" | "them";
  /** Team whose action ended the rally (default: the winner). */
  by?: "us" | "them";
  type?: ScorePoint["point_type"];
  player?: string;
  rotation?: ScorePoint["current_rotation"];
  pointNumber?: number;
  /** Seconds after the match start (default: 30 s after the previous rally). */
  at?: number;
}

export interface SetSpec {
  firstServer?: "us" | "them";
  status?: Set["status"];
  rallies: RallySpec[];
  roles?: Record<string, PlayerRole>;
  lineup?: Set["first_lineup"];
}

export interface DataOptions {
  usIsHome?: boolean;
  format?: Partial<MatchFormat>;
  stats?: PlayerStat[];
  events?: Event[];
  status?: string;
  members?: TeamMember[];
}

const T0 = Date.parse("2026-10-01T18:00:00.000Z");
export const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();
export const setId = (n: number) => `set-${n}`;

/** "WWL": rallies won, won, lost by the managed team, nothing typed. */
export function rallies(pattern: string): RallySpec[] {
  return [...pattern].map((c) => ({ winner: c === "W" ? "us" : "them" }));
}

export const FORMAT: MatchFormat = {
  id: "fmt-6x6",
  description: null,
  format: "6x6",
  sets_to_win: 3,
  rotation: true,
  point_by_set: 25,
  point_final_set: 15,
  decisive_point: false,
};

export function members(): TeamMember[] {
  return Object.values(P).map((id, i) => ({ id, team_id: US, name: NAMES[i], number: i + 1, position: null, role: "player" }));
}

const team = (id: string, name: string): Team => ({
  id,
  name,
  status: "active",
  club_id: id === US ? "club-1" : null,
  championship_id: null,
  ext_code: null,
  ext_source: null,
  created_at: at(0),
  user_id: id === US ? "owner-1" : null,
});

export function makeData(specs: SetSpec[], options: DataOptions = {}): MatchReportData {
  const usIsHome = options.usIsHome ?? true;
  const teamOf = (side: "us" | "them") => (side === "us" ? US : THEM);
  const sets: Set[] = [];
  const points: ScorePoint[] = [];
  let clock = 0;
  specs.forEach((spec, i) => {
    const sid = setId(i + 1);
    const lineup = spec.lineup ?? LINEUP;
    let us = 0;
    let them = 0;
    spec.rallies.forEach((rally, k) => {
      if (rally.winner === "us") us++;
      else them++;
      clock += 30;
      points.push({
        id: `${sid}-r${k + 1}`,
        match_id: MATCH_ID,
        set_id: sid,
        point_number: rally.pointNumber ?? k + 1,
        player_stat_id: null,
        scoring_team_id: teamOf(rally.winner),
        point_type: rally.type ?? "unknown",
        action_team_id: teamOf(rally.by ?? rally.winner),
        // Like the app: `result` is stored from the managed team's point of view.
        result: rally.winner === "us" ? "success" : "error",
        player_id: rally.player ?? null,
        timestamp: at(rally.at ?? clock),
        home_score: usIsHome ? us : them,
        away_score: usIsHome ? them : us,
        current_rotation: rally.rotation ?? lineup,
      });
    });
    const first = teamOf(spec.firstServer ?? "us");
    sets.push({
      id: sid,
      match_id: MATCH_ID,
      set_number: i + 1,
      home_score: usIsHome ? us : them,
      away_score: usIsHome ? them : us,
      status: spec.status ?? "completed",
      first_server_team_id: first,
      server_team_id: first,
      first_lineup: lineup,
      current_lineup: lineup,
      player_roles: spec.roles ?? {},
    });
    clock += 300;
  });
  const usTeam = team(US, "Volley Club");
  const themTeam = team(THEM, "Les Rivales");
  return {
    match: {
      id: MATCH_ID,
      date: at(0),
      location: "Gymnase Jean Moulin",
      home_team_id: usIsHome ? US : THEM,
      away_team_id: usIsHome ? THEM : US,
      championship_id: "champ-1",
      season_id: null,
      match_format_id: FORMAT.id,
      home_score: null,
      away_score: null,
      status: options.status ?? "completed",
      home_available_players: null,
      away_available_players: null,
      ext_code: null,
      ext_source: null,
      home_total: null,
      away_total: null,
      detailed_scores: null,
    },
    format: { ...FORMAT, ...options.format },
    homeTeam: usIsHome ? usTeam : themTeam,
    awayTeam: usIsHome ? themTeam : usTeam,
    championshipName: "Régionale U18",
    members: options.members ?? members(),
    sets,
    points,
    stats: options.stats ?? [],
    events: options.events ?? [],
  };
}

let statCount = 0;
export function stat(
  set: number,
  player: string,
  type: PlayerStat["stat_type"],
  result: PlayerStat["result"],
  position: PlayerStat["position"] = null
): PlayerStat {
  statCount += 1;
  return { id: `stat-${statCount}`, match_id: MATCH_ID, set_id: setId(set), player_id: player, team_id: US, position, stat_type: type, result };
}

let eventCount = 0;
export function event(set: number | null, type: Event["event_type"], fields: Partial<Event> = {}): Event {
  eventCount += 1;
  return {
    id: `event-${eventCount}`,
    match_id: MATCH_ID,
    set_id: set === null ? null : setId(set),
    team_id: null,
    event_type: type,
    timestamp: at(0),
    team: null,
    player_id: null,
    details: {},
    point_number: null,
    ...fields,
  };
}
