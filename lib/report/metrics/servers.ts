import type { PlayerStat } from "@/lib/types";
import { ratio, type Ratio } from "../ratio";
import type { Rally } from "../types";

export interface ServerLine {
  playerId: string;
  served: number;
  won: number;
  breakPct: number | null;
  /** Most points won in one serve turn. */
  longestRun: number;
  /** Serve turns: unbroken runs of this player's serves within a set, ended by a lost rally. */
  turns: number;
  /** Points won per turn, 1 decimal. */
  pointsPerTurn: number | null;
  /** Share of turns that won at least one point. */
  scoringTurnPct: number | null;
  aces: number;
  serveErrors: number;
}

export interface TeamServeTurns {
  turns: number;
  points: number;
  pointsPerTurn: number | null;
  /** Turns that won at least one point. */
  scoring: Ratio;
}

const perTurn = (points: number, turns: number) => (turns === 0 ? null : Math.round((points / turns) * 10) / 10);

export function serverLines(rallies: Rally[], stats: PlayerStat[]): ServerLine[] {
  const lines = new Map<string, ServerLine & { scoringTurns: number }>();
  let turn: { playerId: string; setId: string; points: number } | null = null;
  for (const rally of rallies) {
    const playerId = rally.server === "us" ? rally.serverPlayerId : null;
    if (!playerId) {
      turn = null;
      continue;
    }
    const line = lines.get(playerId) ?? {
      playerId,
      served: 0,
      won: 0,
      breakPct: null,
      longestRun: 0,
      turns: 0,
      pointsPerTurn: null,
      scoringTurnPct: null,
      aces: 0,
      serveErrors: 0,
      scoringTurns: 0,
    };
    lines.set(playerId, line);
    if (!turn || turn.playerId !== playerId || turn.setId !== rally.setId) {
      turn = { playerId, setId: rally.setId, points: 0 };
      line.turns++;
    }
    line.served++;
    if (rally.winner === "us") {
      line.won++;
      turn.points++;
      if (turn.points === 1) line.scoringTurns++;
      line.longestRun = Math.max(line.longestRun, turn.points);
    } else {
      turn = null;
    }
  }
  for (const s of stats) {
    const line = lines.get(s.player_id);
    if (!line || s.stat_type !== "serve") continue;
    if (s.result === "success") line.aces++;
    else if (s.result === "error") line.serveErrors++;
  }
  return [...lines.values()]
    .map(({ scoringTurns, ...line }) => ({
      ...line,
      breakPct: ratio(line.won, line.served).pct,
      pointsPerTurn: perTurn(line.won, line.turns),
      scoringTurnPct: ratio(scoringTurns, line.turns).pct,
    }))
    .sort((a, b) => b.won - a.won || b.served - a.served || a.playerId.localeCompare(b.playerId));
}

/** The team's serve turns, in every format: who serves is known even without rotation. */
export function teamServeTurns(rallies: Rally[]): TeamServeTurns {
  let turns = 0;
  let points = 0;
  let scoringTurns = 0;
  let turnPoints = 0;
  rallies.forEach((rally, i) => {
    if (rally.server !== "us") return;
    const previous = rallies[i - 1];
    // Within a set, serving again means the previous rally was won on our serve.
    if (!previous || previous.setId !== rally.setId || previous.server !== "us") {
      turns++;
      turnPoints = 0;
    }
    if (rally.winner === "us") {
      points++;
      turnPoints++;
      if (turnPoints === 1) scoringTurns++;
    }
  });
  return { turns, points, pointsPerTurn: perTurn(points, turns), scoring: ratio(scoringTurns, turns) };
}
