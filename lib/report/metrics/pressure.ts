import { ratio, type Ratio } from "../ratio";
import type { Rally, Tally } from "../types";

/** Rallies won / played in tight situations, judged on the score before each rally. */
export interface Pressure {
  /** From a level score, 1-1 or higher. */
  tied: Ratio;
  /** Both teams at `target - 5` or more (20-20 in a 25-point set). */
  closeFinish: Ratio;
  /** Both teams at `target - 1` or more (24-24 in a 25-point set). */
  deuce: Ratio;
  /** Behind by 3 points or more. */
  behind: Ratio;
}

type Key = keyof Pressure;
const KEYS: Key[] = ["tied", "closeFinish", "deuce", "behind"];
const CLOSE_FINISH_MARGIN = 5;
const BEHIND_BY = 3;

const toPressure = (counts: Record<Key, Tally>): Pressure =>
  Object.fromEntries(KEYS.map((key) => [key, ratio(counts[key].us, counts[key].us + counts[key].them)])) as unknown as Pressure;

/** Pressure rallies of one set's rallies; `target` is the set's winning score. */
export function setPressure(rallies: Rally[], target: number): Pressure {
  const counts = Object.fromEntries(KEYS.map((key) => [key, { us: 0, them: 0 }])) as Record<Key, Tally>;
  let before: Tally = { us: 0, them: 0 };
  for (const rally of rallies) {
    const low = Math.min(before.us, before.them);
    const situations: Record<Key, boolean> = {
      tied: before.us === before.them && before.us >= 1,
      closeFinish: low >= target - CLOSE_FINISH_MARGIN,
      deuce: low >= target - 1,
      behind: before.them - before.us >= BEHIND_BY,
    };
    for (const key of KEYS) if (situations[key]) counts[key][rally.winner]++;
    before = rally.score;
  }
  return toPressure(counts);
}

/** Match pressure: the sets' counts added up (sets can have different targets). */
export function totalPressure(sets: Pressure[]): Pressure {
  const counts = Object.fromEntries(KEYS.map((key) => [key, { us: 0, them: 0 }])) as Record<Key, Tally>;
  for (const set of sets) {
    for (const key of KEYS) {
      counts[key].us += set[key].made;
      counts[key].them += set[key].of - set[key].made;
    }
  }
  return toPressure(counts);
}
