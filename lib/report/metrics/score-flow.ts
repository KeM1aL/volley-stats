import type { MatchFormat } from "@/lib/types";
import type { Rally, Side, Tally } from "../types";

export interface ScoreFlow {
  largestLead: Tally;
  /** Times the score was level after a rally. */
  ties: number;
  leadChanges: number;
  longestRun: Tally;
  /** Largest deficit the set's leader at the end came back from. */
  deficitOvercome: number;
}

/** Score flow of one set's rallies. */
export function scoreFlow(rallies: Rally[]): ScoreFlow {
  const largestLead: Tally = { us: 0, them: 0 };
  const longestRun: Tally = { us: 0, them: 0 };
  let ties = 0;
  let leadChanges = 0;
  let leader: Side | null = null;
  let previousWinner: Side | null = null;
  let run = 0;
  for (const rally of rallies) {
    const diff = rally.score.us - rally.score.them;
    largestLead.us = Math.max(largestLead.us, diff);
    largestLead.them = Math.max(largestLead.them, -diff);
    if (diff === 0) {
      ties++;
    } else {
      const now: Side = diff > 0 ? "us" : "them";
      if (leader && leader !== now) leadChanges++;
      leader = now;
    }
    run = rally.winner === previousWinner ? run + 1 : 1;
    previousWinner = rally.winner;
    longestRun[rally.winner] = Math.max(longestRun[rally.winner], run);
  }
  return { largestLead, ties, leadChanges, longestRun, deficitOvercome: deficitOvercome(rallies) };
}

function deficitOvercome(rallies: Rally[]): number {
  const last = rallies.at(-1);
  if (!last || last.score.us === last.score.them) return 0;
  const leader: Side = last.score.us > last.score.them ? "us" : "them";
  return rallies.reduce((max, r) => Math.max(max, leader === "us" ? r.score.them - r.score.us : r.score.us - r.score.them), 0);
}

/** Points needed to win the set: `point_final_set` for the deciding set, else `point_by_set`. */
export function setTarget(setNumber: number, format: Pick<MatchFormat, "sets_to_win" | "point_by_set" | "point_final_set">): number {
  return setNumber === format.sets_to_win * 2 - 1 ? format.point_final_set : format.point_by_set;
}

export interface SetEnding {
  threshold: number;
  /** Score when either team first reached the threshold. */
  from: Tally | null;
  /** Rallies won by each team after that point. */
  won: Tally;
}

export function setEnding(rallies: Rally[], target: number): SetEnding {
  const threshold = Math.max(target - 5, 0);
  const start = rallies.findIndex((r) => Math.max(r.score.us, r.score.them) >= threshold);
  if (start === -1) return { threshold, from: null, won: { us: 0, them: 0 } };
  const won: Tally = { us: 0, them: 0 };
  for (const rally of rallies.slice(start + 1)) won[rally.winner]++;
  return { threshold, from: { ...rallies[start].score }, won };
}
