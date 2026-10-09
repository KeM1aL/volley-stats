import type { Event, Match, MatchFormat, PlayerStat, ScorePoint, Set, Team, TeamMember } from "@/lib/types";

export type Side = "us" | "them";
export type StatAction = PlayerStat["stat_type"];

/** Raw inputs of a report. Rows marked `_deleted` are already removed (except referenced members). */
export interface MatchReportData {
  match: Match;
  format: MatchFormat;
  homeTeam: Team;
  awayTeam: Team;
  championshipName: string | null;
  /** Members of both teams, including removed members the match still references. */
  members: TeamMember[];
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
  events: Event[];
}

/** How a rally won by the managed team ended. */
export type WinOrigin = "ace" | "kill" | "block" | "otherWinner" | "opponentError" | "unspecified";
/** How a rally lost by the managed team ended. */
export type LossOrigin = "ownError" | "opponentWinner";

export interface Tally {
  us: number;
  them: number;
}

/** One rally, from the managed team's point of view. */
export interface Rally {
  setId: string;
  setNumber: number;
  /** Position of the rally in its set, from 1. */
  index: number;
  winner: Side;
  server: Side;
  /** The managed team's server (player in p1) when it serves and the format rotates. */
  serverPlayerId: string | null;
  /** The managed team's players on court before the rally. */
  onCourt: string[];
  /** Score after the rally. */
  score: Tally;
  winOrigin: WinOrigin | null;
  lossOrigin: LossOrigin | null;
  /** The managed team's action that ended the rally, when typed. */
  action: StatAction | null;
  /** Whether the rally has a typed action (`point_type` other than `unknown`). */
  typed: boolean;
  timestamp: string;
}
