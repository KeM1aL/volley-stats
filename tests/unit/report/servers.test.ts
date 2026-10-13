import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { serverLines } from "@/lib/report/metrics/servers";
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
      { playerId: P.a, served: 4, won: 3, breakPct: 75, longestRun: 3, aces: 1, serveErrors: 1 },
      { playerId: P.b, served: 2, won: 1, breakPct: 50, longestRun: 1, aces: 0, serveErrors: 0 },
    ]);
  });

  it("does not carry a run across sets", () => {
    const data = makeData([
      { firstServer: "us", rallies: rallies("W") },
      { firstServer: "us", rallies: rallies("W") },
    ]);
    expect(serverLines(buildRallies(data, US), [])).toEqual([
      { playerId: P.a, served: 2, won: 2, breakPct: 100, longestRun: 1, aces: 0, serveErrors: 0 },
    ]);
  });

  it("is empty when the format does not rotate", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WW") }], { format: { rotation: false } });
    expect(serverLines(buildRallies(data, US), [])).toEqual([]);
  });
});
