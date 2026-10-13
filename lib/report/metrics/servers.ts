import type { PlayerStat } from "@/lib/types";
import type { Rally } from "../types";

export interface ServerLine {
  playerId: string;
  served: number;
  won: number;
  breakPct: number | null;
  /** Most rallies won in a row while serving, within one set. */
  longestRun: number;
  aces: number;
  serveErrors: number;
}

export function serverLines(rallies: Rally[], stats: PlayerStat[]): ServerLine[] {
  const lines = new Map<string, ServerLine>();
  let runPlayer: string | null = null;
  let runSet: string | null = null;
  let run = 0;
  for (const rally of rallies) {
    const playerId = rally.server === "us" ? rally.serverPlayerId : null;
    if (!playerId) {
      runPlayer = null;
      run = 0;
      continue;
    }
    const line = lines.get(playerId) ?? { playerId, served: 0, won: 0, breakPct: null, longestRun: 0, aces: 0, serveErrors: 0 };
    lines.set(playerId, line);
    line.served++;
    if (rally.winner === "us") {
      line.won++;
      run = runPlayer === playerId && runSet === rally.setId ? run + 1 : 1;
      runPlayer = playerId;
      runSet = rally.setId;
      line.longestRun = Math.max(line.longestRun, run);
    } else {
      runPlayer = null;
      run = 0;
    }
  }
  for (const s of stats) {
    const line = lines.get(s.player_id);
    if (!line || s.stat_type !== "serve") continue;
    if (s.result === "success") line.aces++;
    else if (s.result === "error") line.serveErrors++;
  }
  for (const line of lines.values()) line.breakPct = line.served === 0 ? null : Math.round((line.won / line.served) * 100);
  return [...lines.values()].sort((a, b) => b.won - a.won || b.served - a.served || a.playerId.localeCompare(b.playerId));
}
