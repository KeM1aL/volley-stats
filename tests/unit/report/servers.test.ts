import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { serverLines, teamServeTurns } from "@/lib/report/metrics/servers";
import { LINEUP, P, US, makeData, rallies, stat } from "./fixtures";

const ROTATED = { p1: P.b, p2: P.c, p3: P.d, p4: P.e, p5: P.f, p6: P.a };

describe("serverLines", () => {
  it("credits each serve to the player in p1, with the longest winning run", () => {
    const data = makeData([
      {
        firstServer: "us",
        rallies: [
          { winner: "us", rotation: LINEUP },
          { winner: "us", rotation: LINEUP },
          { winner: "us", rotation: LINEUP },
          { winner: "them", rotation: LINEUP },
          { winner: "us", rotation: LINEUP }, // they served: side-out
          { winner: "us", rotation: ROTATED },
          { winner: "them", rotation: ROTATED },
        ],
      },
    ]);
    const stats = [stat(1, P.a, "serve", "success"), stat(1, P.a, "serve", "error"), stat(1, P.c, "serve", "success")];
    expect(serverLines(buildRallies(data, US), stats)).toEqual([
      { playerId: P.a, served: 4, won: 3, breakPct: 75, longestRun: 3, turns: 1, pointsPerTurn: 3, scoringTurnPct: 100, aces: 1, serveErrors: 1 },
      { playerId: P.b, served: 2, won: 1, breakPct: 50, longestRun: 1, turns: 1, pointsPerTurn: 1, scoringTurnPct: 100, aces: 0, serveErrors: 0 },
    ]);
  });

  it("does not carry a run across sets", () => {
    const data = makeData([
      { firstServer: "us", rallies: rallies("W") },
      { firstServer: "us", rallies: rallies("W") },
    ]);
    expect(serverLines(buildRallies(data, US), [])).toEqual([
      { playerId: P.a, served: 2, won: 2, breakPct: 100, longestRun: 1, turns: 2, pointsPerTurn: 1, scoringTurnPct: 100, aces: 0, serveErrors: 0 },
    ]);
  });

  it("is empty when the format does not rotate", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WW") }], { format: { rotation: false } });
    expect(serverLines(buildRallies(data, US), [])).toEqual([]);
  });
});

describe("serve turns", () => {
  // We serve r1 (lost: a scoreless turn), they serve r2 (side-out), we serve r3 (won) and r4 (lost).
  const pattern = "LWWL";

  it("counts each player's turns, points per turn and scoring turns", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies(pattern) }]);
    expect(serverLines(buildRallies(data, US), [])[0]).toMatchObject({ playerId: P.a, served: 3, won: 1, turns: 2, pointsPerTurn: 0.5, scoringTurnPct: 50 });
  });

  it("counts the team's turns in every format, rotating or not", () => {
    for (const rotation of [true, false]) {
      const data = makeData([{ firstServer: "us", rallies: rallies(pattern) }], { format: { rotation } });
      expect(teamServeTurns(buildRallies(data, US))).toEqual({ turns: 2, points: 1, pointsPerTurn: 0.5, scoring: { made: 1, of: 2, pct: 50 } });
    }
  });

  it("starts a new turn in each set and has no turns when we never serve", () => {
    const twoSets = makeData([
      { firstServer: "us", rallies: rallies("WW") },
      { firstServer: "us", rallies: rallies("W") },
    ]);
    expect(teamServeTurns(buildRallies(twoSets, US))).toMatchObject({ turns: 2, points: 3, pointsPerTurn: 1.5 });
    const neverServing = makeData([{ firstServer: "them", rallies: rallies("L") }]);
    expect(teamServeTurns(buildRallies(neverServing, US))).toEqual({ turns: 0, points: 0, pointsPerTurn: null, scoring: { made: 0, of: 0, pct: null } });
  });
});
