import type { PlayerStat } from "@/lib/types";
import type { Rally } from "../types";

export interface PlayerTotals {
  aces: number;
  serveErrors: number;
  kills: number;
  attackErrors: number;
  blocks: number;
  blockErrors: number;
  receptionErrors: number;
  defenseErrors: number;
  /** Aces + kills + block points. */
  points: number;
  /** Every `error` result. */
  errors: number;
  /** Points − errors. */
  net: number;
  /** Rallies won − lost while on court. */
  plusMinus: number;
  ralliesOnCourt: number;
}

export interface PlayerLine extends PlayerTotals {
  playerId: string;
}

const emptyTotals = (): PlayerTotals => ({
  aces: 0,
  serveErrors: 0,
  kills: 0,
  attackErrors: 0,
  blocks: 0,
  blockErrors: 0,
  receptionErrors: 0,
  defenseErrors: 0,
  points: 0,
  errors: 0,
  net: 0,
  plusMinus: 0,
  ralliesOnCourt: 0,
});

/** One line per player with a stat or on court. `stats` and `rallies` cover the same scope (match or set). */
export function playerLines(stats: PlayerStat[], rallies: Rally[]): PlayerLine[] {
  const lines = new Map<string, PlayerLine>();
  const lineOf = (playerId: string): PlayerLine => {
    let line = lines.get(playerId);
    if (!line) {
      line = { playerId, ...emptyTotals() };
      lines.set(playerId, line);
    }
    return line;
  };
  for (const s of stats) {
    const line = lineOf(s.player_id);
    if (s.result === "success") {
      if (s.stat_type === "serve") line.aces++;
      else if (s.stat_type === "spike") line.kills++;
      else if (s.stat_type === "block") line.blocks++;
    } else if (s.result === "error") {
      line.errors++;
      if (s.stat_type === "serve") line.serveErrors++;
      else if (s.stat_type === "spike") line.attackErrors++;
      else if (s.stat_type === "block") line.blockErrors++;
      else if (s.stat_type === "reception") line.receptionErrors++;
      else line.defenseErrors++;
    }
  }
  for (const rally of rallies) {
    for (const playerId of rally.onCourt) {
      const line = lineOf(playerId);
      line.ralliesOnCourt++;
      line.plusMinus += rally.winner === "us" ? 1 : -1;
    }
  }
  for (const line of lines.values()) {
    line.points = line.aces + line.kills + line.blocks;
    line.net = line.points - line.errors;
  }
  return [...lines.values()];
}

/** Team row: sums of the lines, with the team's rallies won − lost as +/-. */
export function teamTotals(lines: PlayerLine[], rallies: Rally[]): PlayerTotals {
  const total = emptyTotals();
  const keys = Object.keys(total) as (keyof PlayerTotals)[];
  for (const line of lines) for (const key of keys) total[key] += line[key];
  const won = rallies.filter((rally) => rally.winner === "us").length;
  total.plusMinus = won - (rallies.length - won);
  total.ralliesOnCourt = rallies.length;
  return total;
}
