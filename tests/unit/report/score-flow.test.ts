import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { scoreFlow, setEnding, setTarget } from "@/lib/report/metrics/score-flow";
import { FORMAT, US, makeData, rallies } from "./fixtures";

const ralliesOf = (pattern: string) => buildRallies(makeData([{ rallies: rallies(pattern) }]), US);

describe("scoreFlow", () => {
  it("measures leads, ties, lead changes, runs and the deficit the winner overcame", () => {
    // Scores: 1-0 2-0 2-1 2-2 2-3 3-3 4-3 5-3
    expect(scoreFlow(ralliesOf("WWLLLWWW"))).toEqual({
      largestLead: { us: 2, them: 1 },
      ties: 2,
      leadChanges: 2,
      longestRun: { us: 3, them: 3 },
      deficitOvercome: 1,
    });
  });

  it("is all zeros without rallies", () => {
    expect(scoreFlow([])).toEqual({ largestLead: { us: 0, them: 0 }, ties: 0, leadChanges: 0, longestRun: { us: 0, them: 0 }, deficitOvercome: 0 });
  });
});

describe("setTarget", () => {
  it("uses the final-set target only for the deciding set", () => {
    expect(setTarget(4, FORMAT)).toBe(25);
    expect(setTarget(5, FORMAT)).toBe(15);
    expect(setTarget(3, { ...FORMAT, sets_to_win: 2 })).toBe(15);
  });
});

describe("setEnding", () => {
  it("counts the rallies played after either team reached target - 5", () => {
    const ending = setEnding(ralliesOf(`${"W".repeat(20)}LLW`), 25);
    expect(ending).toEqual({ threshold: 20, from: { us: 20, them: 0 }, won: { us: 1, them: 2 } });
  });

  it("starts at 10 in a 15-point set", () => {
    expect(setEnding(ralliesOf(`${"L".repeat(10)}W`), 15)).toEqual({ threshold: 10, from: { us: 0, them: 10 }, won: { us: 1, them: 0 } });
  });

  it("has no start when the threshold was not reached", () => {
    expect(setEnding(ralliesOf("WWL"), 25)).toEqual({ threshold: 20, from: null, won: { us: 0, them: 0 } });
  });
});
