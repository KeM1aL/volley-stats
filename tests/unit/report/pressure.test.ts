import { describe, expect, it } from "vitest";
import { setPressure, totalPressure } from "@/lib/report/metrics/pressure";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { US, makeData, rallies } from "./fixtures";

const ralliesOf = (pattern: string) => buildRallies(makeData([{ rallies: rallies(pattern) }]), US);

describe("setPressure", () => {
  it("counts rallies played from a tie, excluding 0-0", () => {
    // Scores before each rally: 0-0, 1-0, 1-1, 2-1, 2-2
    expect(setPressure(ralliesOf("WLWLL"), 25).tied).toEqual({ made: 1, of: 2, pct: 50 });
  });

  it("counts rallies played when behind by 3 or more", () => {
    // Before: 0-0, 0-1, 0-2, 0-3 (won), 1-3, 1-4 (lost)
    expect(setPressure(ralliesOf("LLLWLL"), 25).behind).toEqual({ made: 1, of: 2, pct: 50 });
  });

  it("counts the close finish from target - 5 all and deuce from target - 1 all", () => {
    // Target 8: close finish from 3-3, deuce from 7-7. Ends 10-8.
    const pressure = setPressure(ralliesOf(`${"WL".repeat(7)}WLWW`), 8);
    expect(pressure.closeFinish).toEqual({ made: 7, of: 12, pct: 58 });
    expect(pressure.deuce).toEqual({ made: 3, of: 4, pct: 75 });
    expect(pressure.tied).toEqual({ made: 8, of: 8, pct: 100 });
    expect(pressure.behind).toEqual({ made: 0, of: 0, pct: null });
  });

  it("has no pressure rallies without rallies", () => {
    expect(setPressure([], 25)).toEqual({
      tied: { made: 0, of: 0, pct: null },
      closeFinish: { made: 0, of: 0, pct: null },
      deuce: { made: 0, of: 0, pct: null },
      behind: { made: 0, of: 0, pct: null },
    });
  });
});

describe("totalPressure", () => {
  it("adds the sets' counts", () => {
    const total = totalPressure([setPressure(ralliesOf("WLWLL"), 25), setPressure(ralliesOf("LLLWLL"), 25)]);
    expect(total.tied).toEqual({ made: 1, of: 2, pct: 50 });
    expect(total.behind).toEqual({ made: 1, of: 2, pct: 50 });
  });
});
