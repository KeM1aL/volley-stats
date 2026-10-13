import { describe, expect, it } from "vitest";
import { mvp, mvpScores } from "@/lib/report/metrics/mvp";
import { P, stat } from "./fixtures";

describe("mvp", () => {
  it("scores bad as 0, not like good (former bug)", () => {
    expect(mvp([stat(1, P.a, "reception", "bad"), stat(1, P.a, "reception", "bad")])).toBeNull();
    expect(mvpScores([stat(1, P.a, "reception", "good"), stat(1, P.a, "reception", "good")]).get(P.a)).toBe(1);
  });

  it("weights actions and subtracts errors", () => {
    const stats = [
      stat(1, P.a, "serve", "success"),
      stat(1, P.a, "serve", "success"),
      stat(1, P.a, "serve", "error"),
      stat(1, P.b, "spike", "success"),
      stat(1, P.c, "block", "error"),
    ];
    expect(mvpScores(stats)).toEqual(new Map([[P.a, 1], [P.b, 1.2], [P.c, -1.5]]));
    expect(mvp(stats)).toEqual({ playerId: P.b, score: 1.2 });
  });

  it("breaks ties on the lower player id", () => {
    expect(mvp([stat(1, P.b, "serve", "success"), stat(1, P.a, "serve", "success")])).toEqual({ playerId: P.a, score: 1 });
  });

  it("has no MVP without a positive score", () => {
    expect(mvp([])).toBeNull();
    expect(mvp([stat(1, P.a, "spike", "error")])).toBeNull();
  });
});
