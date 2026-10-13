import type { Rally } from "../types";
import { FRONT_ROW } from "./zones";

export interface RowPlusMinus {
  /** Rallies won − lost in this row. */
  plusMinus: number;
  rallies: number;
}

export interface RowLine {
  playerId: string;
  /** At p2, p3 or p4. */
  front: RowPlusMinus;
  /** At p1, p5 or p6. */
  back: RowPlusMinus;
}

/** Each on-court player's +/- split by the row they stood in before each rally (6x6 lineups). */
export function rowLines(rallies: Rally[]): RowLine[] {
  const lines = new Map<string, RowLine>();
  for (const rally of rallies) {
    const delta = rally.winner === "us" ? 1 : -1;
    for (const [playerId, zone] of Object.entries(rally.positions)) {
      const line = lines.get(playerId) ?? { playerId, front: { plusMinus: 0, rallies: 0 }, back: { plusMinus: 0, rallies: 0 } };
      lines.set(playerId, line);
      const row = FRONT_ROW.includes(zone) ? line.front : line.back;
      row.plusMinus += delta;
      row.rallies++;
    }
  }
  return [...lines.values()];
}
