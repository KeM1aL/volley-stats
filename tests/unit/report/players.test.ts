import { describe, expect, it } from "vitest";
import { playerLines, teamTotals } from "@/lib/report/metrics/players";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { P, US, makeData, rallies, stat } from "./fixtures";

describe("playerLines", () => {
  const stats = [
    stat(1, P.a, "serve", "success"),
    stat(1, P.a, "serve", "success"),
    stat(1, P.a, "serve", "error"),
    stat(1, P.a, "spike", "success"),
    stat(1, P.a, "reception", "error"),
    stat(1, P.a, "defense", "good"),
    stat(1, P.g, "block", "success"),
  ];
  const data = makeData([{ rallies: rallies("WWL") }], { stats });
  const rallyList = buildRallies(data, US);
  const lines = playerLines(stats, rallyList);
  const lineOf = (id: string) => lines.find((line) => line.playerId === id)!;

  it("counts rally-ending actions and ignores good / bad", () => {
    expect(lineOf(P.a)).toMatchObject({
      aces: 2,
      serveErrors: 1,
      kills: 1,
      attackErrors: 0,
      receptionErrors: 1,
      defenseErrors: 0,
      points: 3,
      errors: 2,
      net: 1,
    });
  });

  it("gives +/- over the rallies a player was on court", () => {
    expect(lineOf(P.a)).toMatchObject({ plusMinus: 1, ralliesOnCourt: 3 });
    expect(lineOf(P.g)).toMatchObject({ blocks: 1, points: 1, plusMinus: 0, ralliesOnCourt: 0 });
  });

  it("lists every player on court, even without stats", () => {
    expect(lines.map((line) => line.playerId).sort()).toEqual([P.a, P.b, P.c, P.d, P.e, P.f, P.g].sort());
  });

  it("totals the team with the team's own +/-", () => {
    expect(teamTotals(lines, rallyList)).toMatchObject({ aces: 2, kills: 1, blocks: 1, points: 4, errors: 2, net: 2, plusMinus: 1, ralliesOnCourt: 3 });
  });
});
