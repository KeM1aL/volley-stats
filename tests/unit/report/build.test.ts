import { describe, expect, it } from "vitest";
import { buildMatchReport } from "@/lib/report/build";
import { P, THEM, US, event, makeData, rallies, stat } from "./fixtures";

describe("buildMatchReport", () => {
  it("counts sets won from the managed team's side, also away", () => {
    for (const usIsHome of [true, false]) {
      const data = makeData([{ rallies: rallies("WWW") }, { rallies: rallies("LL") }, { rallies: rallies("W"), status: "live" }], {
        usIsHome,
        status: "live",
      });
      const model = buildMatchReport(data, US);
      expect(model.usIsHome).toBe(usIsHome);
      expect(model.us.name).toBe("Volley Club");
      expect(model.setsWon).toEqual({ us: 1, them: 1 });
      expect(model.sets.map((s) => [s.score, s.winner])).toEqual([
        [{ us: 3, them: 0 }, "us"],
        [{ us: 0, them: 2 }, "them"],
        [{ us: 1, them: 0 }, null],
      ]);
      expect(model.completed).toBe(false);
    }
  });

  it("reports a set that was never played without NaN", () => {
    const model = buildMatchReport(makeData([{ rallies: rallies("WL") }, { rallies: [], status: "upcoming" }]), US);
    const empty = model.sets[1];
    expect(empty).toMatchObject({ rallies: [], durationMinutes: null, winner: null, mvp: null, ending: { from: null } });
    expect(empty.team.sideOut.pct).toBeNull();
    expect(JSON.stringify(model)).not.toMatch(/NaN|Infinity/);
  });

  it("keeps only the managed team's stats and sorts players by number", () => {
    const stats = [stat(1, P.c, "spike", "success"), stat(1, P.a, "serve", "success"), { ...stat(1, "opponent-1", "spike", "success"), team_id: THEM }];
    const model = buildMatchReport(makeData([{ rallies: rallies("WW") }], { stats }), US);
    expect(model.players.map((p) => p.playerId)).toEqual([P.a, P.b, P.c, P.d, P.e, P.f]);
    expect(model.total.points).toBe(2);
    expect(model.leaders.topScorers).toEqual([
      { playerId: P.a, points: 1 },
      { playerId: P.c, points: 1 },
    ]);
    expect(model.mvp).toEqual({ playerId: P.c, score: 1.2 });
  });

  it("drops court zones outside 6x6 and servers without rotation", () => {
    expect(buildMatchReport(makeData([{ rallies: rallies("W") }]), US)).toMatchObject({ zones: expect.any(Object), servers: expect.any(Array) });
    expect(buildMatchReport(makeData([{ rallies: rallies("W") }], { format: { format: "4x4" } }), US).zones).toBeNull();
    const noRotation = buildMatchReport(makeData([{ rallies: rallies("W") }], { format: { rotation: false } }), US);
    expect(noRotation.servers).toBeNull();
    expect(noRotation.sets[0].servers).toBeNull();
  });

  it("splits events into set timelines and match-level events", () => {
    const inSet = event(1, "timeout", { point_number: 1 });
    const outside = event(null, "comment", { details: { text: "Warm-up was short" } });
    const model = buildMatchReport(makeData([{ rallies: rallies("WW") }], { events: [inSet, outside] }), US);
    expect(model.sets[0].events.map((e) => e.eventId)).toEqual([inSet.id]);
    expect(model.matchEvents).toEqual([{ eventId: outside.id, type: "comment", team: null, text: "Warm-up was short", timestamp: outside.timestamp }]);
  });

  it("measures durations from the first to the last rally", () => {
    const model = buildMatchReport(makeData([{ rallies: rallies("WWWW") }]), US);
    expect(model.sets[0].durationMinutes).toBe(2); // 90 s rounded
    expect(model.members[P.c]).toEqual({ name: "Chloé", number: 3 });
  });

  it("adds pressure points per set and for the match, using each set's own target", () => {
    // Set 1 (target 25) is tied at 1-1 once; set 5 is the 15-point deciding set.
    const data = makeData([{ rallies: rallies("WLW") }, { rallies: rallies("L") }, { rallies: rallies("L") }, { rallies: rallies("L") }, { rallies: rallies("LLLW") }]);
    const model = buildMatchReport(data, US);
    expect(model.sets[0].pressure.tied).toEqual({ made: 1, of: 1, pct: 100 });
    expect(model.sets[4].pressure.behind).toEqual({ made: 1, of: 1, pct: 100 });
    expect(model.pressure.tied).toEqual({ made: 1, of: 1, pct: 100 });
    expect(model.pressure.behind).toEqual({ made: 1, of: 1, pct: 100 });
  });

  it("adds the team serve turns and the row +/- (6x6 only), sorted by number", () => {
    const model = buildMatchReport(makeData([{ firstServer: "us", rallies: rallies("WWL") }]), US);
    expect(model.serveTurns).toEqual({ turns: 1, points: 2, pointsPerTurn: 2, scoring: { made: 1, of: 1, pct: 100 } });
    expect(model.rows?.map((line) => line.playerId)).toEqual([P.a, P.b, P.c, P.d, P.e, P.f]);
    expect(model.rows?.[0]).toEqual({ playerId: P.a, front: { plusMinus: 0, rallies: 0 }, back: { plusMinus: 1, rallies: 3 } });
    expect(buildMatchReport(makeData([{ rallies: rallies("W") }], { format: { format: "4x4" } }), US).rows).toBeNull();
  });
});
