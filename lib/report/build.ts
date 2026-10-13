import type { Set } from "@/lib/types";
import { eventImpacts, eventSide, eventText, type EventImpact } from "./metrics/event-impact";
import { mvp, type MvpResult } from "./metrics/mvp";
import { playerLines, teamTotals, type PlayerLine, type PlayerTotals } from "./metrics/players";
import { setPressure, totalPressure, type Pressure } from "./metrics/pressure";
import { buildRallies } from "./metrics/rallies";
import { roleLines, type RoleLine } from "./metrics/roles";
import { rowLines, type RowLine } from "./metrics/rows";
import { scoreFlow, setEnding, setTarget, type ScoreFlow, type SetEnding } from "./metrics/score-flow";
import { serverLines, teamServeTurns, type ServerLine, type TeamServeTurns } from "./metrics/servers";
import { summarizeTeam, type TeamSummary } from "./metrics/team";
import { lineupByZone, zoneSummary, type Zone, type ZoneSummary } from "./metrics/zones";
import type { MatchReportData, Rally, Side, Tally } from "./types";

export interface MemberInfo {
  name: string;
  number: number | null;
}

export interface MatchEventLine {
  eventId: string;
  type: EventImpact["type"];
  team: Side | null;
  text: string | null;
  timestamp: string;
}

export interface SetReport {
  setId: string;
  number: number;
  status: Set["status"];
  score: Tally;
  winner: Side | null;
  durationMinutes: number | null;
  firstServer: Side;
  startingSix: Partial<Record<Zone, string>>;
  target: number;
  rallies: Rally[];
  team: TeamSummary;
  flow: ScoreFlow;
  ending: SetEnding;
  pressure: Pressure;
  events: EventImpact[];
  players: PlayerLine[];
  total: PlayerTotals;
  servers: ServerLine[] | null;
  mvp: MvpResult | null;
}

export interface Leaders {
  topScorers: { playerId: string; points: number }[];
  bestServer: ServerLine | null;
  bestPlusMinus: { playerId: string; plusMinus: number } | null;
}

export interface MatchReportModel {
  matchId: string;
  date: string;
  location: string | null;
  championship: string | null;
  completed: boolean;
  us: { id: string; name: string };
  them: { id: string; name: string };
  usIsHome: boolean;
  format: { format: string; rotation: boolean; sixPlayers: boolean };
  setsWon: Tally;
  durationMinutes: number | null;
  team: TeamSummary;
  pressure: Pressure;
  serveTurns: TeamServeTurns;
  players: PlayerLine[];
  total: PlayerTotals;
  /** +/- by row per player, 6x6 only. */
  rows: RowLine[] | null;
  roles: RoleLine[];
  zones: ZoneSummary | null;
  servers: ServerLine[] | null;
  mvp: MvpResult | null;
  leaders: Leaders;
  sets: SetReport[];
  matchEvents: MatchEventLine[];
  members: Record<string, MemberInfo>;
}

export function buildMatchReport(data: MatchReportData, managedTeamId: string): MatchReportModel {
  const usIsHome = data.match.home_team_id === managedTeamId;
  const usTeam = usIsHome ? data.homeTeam : data.awayTeam;
  const themTeam = usIsHome ? data.awayTeam : data.homeTeam;
  const sixPlayers = data.format.format === "6x6";
  const rallies = buildRallies(data, managedTeamId);
  const stats = data.stats.filter((s) => s.team_id === managedTeamId);
  const members: Record<string, MemberInfo> = Object.fromEntries(
    data.members.map((m) => [m.id, { name: m.name, number: Number.isFinite(m.number) ? m.number : null }])
  );
  const sortPlayers = <T extends { playerId: string }>(lines: T[]): T[] =>
    [...lines].sort(
      (a, b) =>
        (members[a.playerId]?.number ?? 999) - (members[b.playerId]?.number ?? 999) ||
        (members[a.playerId]?.name ?? "").localeCompare(members[b.playerId]?.name ?? "") ||
        a.playerId.localeCompare(b.playerId)
    );
  const impacts = eventImpacts(data.events, rallies, usIsHome, managedTeamId);

  const sets = [...data.sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((set): SetReport => {
      const setRallies = rallies.filter((r) => r.setId === set.id);
      const setStats = stats.filter((s) => s.set_id === set.id);
      const score: Tally = usIsHome ? { us: set.home_score, them: set.away_score } : { us: set.away_score, them: set.home_score };
      const players = sortPlayers(playerLines(setStats, setRallies));
      const target = setTarget(set.set_number, data.format);
      return {
        setId: set.id,
        number: set.set_number,
        status: set.status,
        score,
        winner: set.status === "completed" && score.us !== score.them ? (score.us > score.them ? "us" : "them") : null,
        durationMinutes: duration(setRallies),
        firstServer: set.first_server_team_id === managedTeamId ? "us" : "them",
        startingSix: lineupByZone(set.first_lineup),
        target,
        rallies: setRallies,
        team: summarizeTeam(setRallies),
        flow: scoreFlow(setRallies),
        ending: setEnding(setRallies, target),
        pressure: setPressure(setRallies, target),
        events: impacts.filter((e) => e.setId === set.id),
        players,
        total: teamTotals(players, setRallies),
        servers: data.format.rotation ? serverLines(setRallies, setStats) : null,
        mvp: mvp(setStats),
      };
    });

  const players = sortPlayers(playerLines(stats, rallies));
  const servers = data.format.rotation ? serverLines(rallies, stats) : null;
  return {
    matchId: data.match.id,
    date: data.match.date,
    location: data.match.location,
    championship: data.championshipName,
    completed: data.match.status === "completed",
    us: { id: usTeam.id, name: usTeam.name },
    them: { id: themTeam.id, name: themTeam.name },
    usIsHome,
    format: { format: data.format.format, rotation: data.format.rotation, sixPlayers },
    setsWon: { us: sets.filter((s) => s.winner === "us").length, them: sets.filter((s) => s.winner === "them").length },
    durationMinutes: duration(rallies),
    team: summarizeTeam(rallies),
    pressure: totalPressure(sets.map((set) => set.pressure)),
    serveTurns: teamServeTurns(rallies),
    players,
    total: teamTotals(players, rallies),
    rows: sixPlayers ? sortPlayers(rowLines(rallies)) : null,
    roles: roleLines(stats, data.sets),
    zones: sixPlayers ? zoneSummary(stats, data.points) : null,
    servers,
    mvp: mvp(stats),
    leaders: leaders(players, servers),
    sets,
    matchEvents: data.events
      .filter((e) => !e.set_id)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      .map((e) => ({ eventId: e.id, type: e.event_type, team: eventSide(e, usIsHome, managedTeamId), text: eventText(e), timestamp: e.timestamp })),
    members,
  };
}

function duration(rallies: Rally[]): number | null {
  if (rallies.length < 2) return null;
  return Math.round((Date.parse(rallies[rallies.length - 1].timestamp) - Date.parse(rallies[0].timestamp)) / 60_000);
}

function leaders(players: PlayerLine[], servers: ServerLine[] | null): Leaders {
  const topScorers = players
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points || b.net - a.net || a.playerId.localeCompare(b.playerId))
    .slice(0, 3)
    .map((p) => ({ playerId: p.playerId, points: p.points }));
  const bestServer =
    [...(servers ?? [])].filter((s) => s.won > 0).sort((a, b) => b.longestRun - a.longestRun || (b.breakPct ?? 0) - (a.breakPct ?? 0))[0] ?? null;
  const onCourt = players.filter((p) => p.ralliesOnCourt > 0).sort((a, b) => b.plusMinus - a.plusMinus || a.playerId.localeCompare(b.playerId));
  const bestPlusMinus = onCourt[0] ? { playerId: onCourt[0].playerId, plusMinus: onCourt[0].plusMinus } : null;
  return { topScorers, bestServer, bestPlusMinus };
}
