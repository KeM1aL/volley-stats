import { describe, expect, it } from "vitest";
import { PlayerRole } from "@/lib/enums";
import { roleLines } from "@/lib/report/metrics/roles";
import { lineupByZone, zoneSummary } from "@/lib/report/metrics/zones";
import { LINEUP, P, makeData, rallies, stat } from "./fixtures";

describe("roleLines", () => {
  it("sums points and errors by the role played in each set, with the top scorer", () => {
    const stats = [
      stat(1, P.d, "spike", "success"),
      stat(1, P.d, "spike", "success"),
      stat(1, P.b, "spike", "success"),
      stat(1, P.b, "spike", "error"),
      stat(1, P.c, "block", "success"),
      stat(1, P.g, "serve", "error"),
      stat(1, P.a, "reception", "good"),
    ];
    const data = makeData([
      { rallies: rallies("W"), roles: { [P.d]: PlayerRole.OUTSIDE_HITTER, [P.b]: PlayerRole.OUTSIDE_HITTER, [P.c]: PlayerRole.MIDDLE_HITTER } },
    ]);
    expect(roleLines(stats, data.sets)).toEqual([
      { role: "outside_hitter", points: 3, errors: 1, topScorerId: P.d, topScorerPoints: 2 },
      { role: "middle_hitter", points: 1, errors: 0, topScorerId: P.c, topScorerPoints: 1 },
      { role: "none", points: 0, errors: 1, topScorerId: null, topScorerPoints: 0 },
    ]);
  });
});

describe("zoneSummary", () => {
  it("uses the stat position, then the player's spot in the rally rotation", () => {
    const placed = stat(1, P.d, "spike", "success", "p4");
    const fromRotation = stat(1, P.b, "spike", "error");
    const libero = stat(1, P.g, "defense", "error");
    const data = makeData([{ rallies: rallies("WL") }]);
    data.points[1].player_stat_id = fromRotation.id;
    const summary = zoneSummary([placed, fromRotation, libero], data.points);
    expect(summary.zones.p4).toEqual({ points: 1, errors: 0 });
    expect(summary.zones.p2).toEqual({ points: 0, errors: 1 });
    expect(summary.frontRow).toEqual({ points: 1, errors: 1 });
    expect(summary.backRow).toEqual({ points: 0, errors: 0 });
    expect(summary.unplaced).toBe(1);
  });

  it("counts a position outside p1-p6 as unplaced, falling back to the rotation", () => {
    const blank = stat(1, P.d, "spike", "success", "" as never);
    const p7 = stat(1, P.g, "spike", "error", "p7" as never);
    const fromRotation = stat(1, P.b, "spike", "error", "p9" as never);
    const data = makeData([{ rallies: rallies("WL") }]);
    data.points[1].player_stat_id = fromRotation.id;
    const summary = zoneSummary([blank, p7, fromRotation], data.points);
    expect(summary.unplaced).toBe(2);
    expect(summary.zones.p2).toEqual({ points: 0, errors: 1 });
  });

  it("maps a lineup to zones", () => {
    expect(lineupByZone(LINEUP)).toEqual({ p1: P.a, p2: P.b, p3: P.c, p4: P.d, p5: P.e, p6: P.f });
    expect(lineupByZone(null)).toEqual({});
  });
});
