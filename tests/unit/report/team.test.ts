import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { summarizeTeam } from "@/lib/report/metrics/team";
import { P, US, makeData, rallies } from "./fixtures";

describe("summarizeTeam", () => {
  it("counts where the points came from", () => {
    const data = makeData([
      {
        rallies: [
          { winner: "us", type: "serve", player: P.a },
          { winner: "us", type: "spike", player: P.b },
          { winner: "us", by: "them" },
          { winner: "us" },
          { winner: "them", by: "us", type: "serve", player: P.a },
          { winner: "them", by: "us" },
          { winner: "them" },
        ],
      },
    ]);
    const summary = summarizeTeam(buildRallies(data, US));
    expect(summary).toMatchObject({ rallies: 7, won: 4, lost: 3 });
    expect(summary.wonBy).toEqual({ ace: 1, kill: 1, block: 0, otherWinner: 0, opponentError: 1, unspecified: 1 });
    expect(summary.lostBy).toEqual({ ownError: 2, opponentWinner: 1 });
    expect(summary.ownErrorsByAction).toEqual({ serve: 1, reception: 0, spike: 0, block: 0, defense: 0, unspecified: 1 });
  });

  it("computes side-out and break-point rates from the serve order", () => {
    // Them serve r1 (we win: side-out), we serve r2 (lost), them serve r3 (won), we serve r4 (lost).
    const data = makeData([{ firstServer: "them", rallies: rallies("WLWL") }]);
    const summary = summarizeTeam(buildRallies(data, US));
    expect(summary.sideOut).toEqual({ made: 2, of: 2, pct: 100 });
    expect(summary.breakPoint).toEqual({ made: 0, of: 2, pct: 0 });
  });

  it("measures how many rallies have a typed action", () => {
    const data = makeData([{ rallies: [{ winner: "us", type: "spike", player: P.b }, ...rallies("WLL")] }]);
    expect(summarizeTeam(buildRallies(data, US)).coverage).toEqual({ made: 1, of: 4, pct: 25 });
  });

  it("returns null rates instead of NaN without rallies", () => {
    const summary = summarizeTeam([]);
    expect(summary.sideOut.pct).toBeNull();
    expect(summary.breakPoint.pct).toBeNull();
    expect(summary.coverage.pct).toBeNull();
  });
});
