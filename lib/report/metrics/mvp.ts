import type { PlayerStat } from "@/lib/types";
import type { StatAction } from "../types";

const WEIGHTS: Record<StatAction, number> = { serve: 1, spike: 1.2, block: 1.5, reception: 1, defense: 1.2 };
const BASE: Record<PlayerStat["result"], number> = { success: 1, good: 0.5, bad: 0, error: -1 };

export interface MvpResult {
  playerId: string;
  score: number;
}

/** Sum of base × weight per player, rounded to 2 decimals. */
export function mvpScores(stats: PlayerStat[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const s of stats) scores.set(s.player_id, (scores.get(s.player_id) ?? 0) + BASE[s.result] * WEIGHTS[s.stat_type]);
  for (const [playerId, score] of scores) scores.set(playerId, Math.round(score * 100) / 100);
  return scores;
}

/** Highest positive score; ties go to the lower player id so the result is stable. */
export function mvp(stats: PlayerStat[]): MvpResult | null {
  let best: MvpResult | null = null;
  for (const [playerId, score] of mvpScores(stats)) {
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && playerId < best.playerId)) best = { playerId, score };
  }
  return best;
}
