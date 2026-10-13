import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { rowLines } from "@/lib/report/metrics/rows";
import { LINEUP, P, US, makeData } from "./fixtures";

const ROTATED = { p1: P.b, p2: P.c, p3: P.d, p4: P.a, p5: P.e, p6: P.f };

describe("rowLines", () => {
  const data = makeData([
    {
      rallies: [
        { winner: "us", rotation: LINEUP },
        { winner: "them", rotation: ROTATED },
        { winner: "them", rotation: ROTATED },
      ],
    },
  ]);
  const lines = rowLines(buildRallies(data, US));
  const lineOf = (id: string) => lines.find((line) => line.playerId === id);

  it("splits each player's +/- between front row (p2-p4) and back row (p1, p5, p6)", () => {
    // Alice: p1 (back) won, then p4 (front) lost twice. Bea: p2 (front) won, then p1 (back) lost twice.
    expect(lineOf(P.a)).toEqual({ playerId: P.a, front: { plusMinus: -2, rallies: 2 }, back: { plusMinus: 1, rallies: 1 } });
    expect(lineOf(P.b)).toEqual({ playerId: P.b, front: { plusMinus: 1, rallies: 1 }, back: { plusMinus: -2, rallies: 2 } });
  });

  it("lists only players who were on court", () => {
    expect(lineOf(P.g)).toBeUndefined();
    expect(lines).toHaveLength(6);
  });
});
