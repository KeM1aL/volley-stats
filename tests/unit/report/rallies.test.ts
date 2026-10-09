import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { P, US, makeData, rallies } from "./fixtures";

describe("buildRallies", () => {
  it("passes the serve to the winner of each rally", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WLLW") }]);
    expect(buildRallies(data, US).map((r) => r.server)).toEqual(["us", "us", "them", "them"]);
  });

  it("names the player in p1 as our server only when we serve and the format rotates", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WLL") }]);
    expect(buildRallies(data, US).map((r) => r.serverPlayerId)).toEqual([P.a, P.a, null]);
    const noRotation = makeData([{ firstServer: "us", rallies: rallies("W") }], { format: { rotation: false } });
    expect(buildRallies(noRotation, US)[0].serverPlayerId).toBeNull();
  });

  it("classifies how each rally ended from the scoring and acting teams, never from result", () => {
    const data = makeData([
      {
        rallies: [
          { winner: "us", type: "serve", player: P.a },
          { winner: "us", type: "spike", player: P.b },
          { winner: "us", type: "block", player: P.c },
          { winner: "us", type: "defense", player: P.d },
          { winner: "us", by: "them" },
          { winner: "us" },
          { winner: "them", by: "us", type: "reception", player: P.e },
          { winner: "them", by: "us" },
          { winner: "them" },
        ],
      },
    ]);
    const result = buildRallies(data, US);
    expect(result.map((r) => r.winOrigin)).toEqual(["ace", "kill", "block", "otherWinner", "opponentError", "unspecified", null, null, null]);
    expect(result.map((r) => r.lossOrigin)).toEqual([null, null, null, null, null, null, "ownError", "ownError", "opponentWinner"]);
    expect(result.map((r) => r.action)).toEqual(["serve", "spike", "block", "defense", null, null, "reception", null, null]);
    expect(result.map((r) => r.typed)).toEqual([true, true, true, true, false, false, true, false, false]);
  });

  it("reports the score from the managed team's side when it plays away", () => {
    const data = makeData([{ rallies: rallies("WWL") }], { usIsHome: false });
    expect(buildRallies(data, US).map((r) => r.score)).toEqual([
      { us: 1, them: 0 },
      { us: 2, them: 0 },
      { us: 2, them: 1 },
    ]);
  });

  it("orders sets by number and rallies by point number, then time, with indexes 1..n", () => {
    const data = makeData([
      { rallies: rallies("WL") },
      { rallies: [{ winner: "us", pointNumber: 1, at: 900 }, { winner: "them", pointNumber: 1, at: 899 }] },
    ]);
    data.sets.reverse();
    data.points.reverse();
    expect(buildRallies(data, US).map((r) => [r.setNumber, r.index, r.winner])).toEqual([
      [1, 1, "us"],
      [1, 2, "them"],
      [2, 1, "them"],
      [2, 2, "us"],
    ]);
  });

  it("lists our players on court before the rally", () => {
    const data = makeData([{ rallies: [{ winner: "us", rotation: { p1: P.g, p2: P.b } }] }]);
    expect(buildRallies(data, US)[0].onCourt).toEqual([P.g, P.b]);
  });
});
