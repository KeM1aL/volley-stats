import { describe, expect, it } from "vitest";
import { hapticFor } from "@/lib/matches/haptics";
import type { MatchState } from "@/lib/commands/command";
import type { Match, Set } from "@/lib/types";
import { aSet } from "../helpers/fixtures";

const matchId = "20000000-0000-4000-8000-000000000001";

const aMatch = (status: string) => ({ id: matchId, status }) as unknown as Match;
const setRow = (overrides: Record<string, unknown> = {}) => aSet(matchId, overrides) as unknown as Set;

function state(match: Match, currentSet: Set | null): MatchState {
  return {
    match,
    currentSet,
    setPoints: [],
    points: [],
    sets: currentSet ? [currentSet] : [],
    setStats: [],
    stats: [],
    setEvents: [],
    events: [],
    score: { home: 0, away: 0 },
  } as MatchState;
}

describe("hapticFor", () => {
  it("taps for a point in the middle of a set", () => {
    const set = setRow({ id: "set-1", home_score: 10, away_score: 8 });
    const next = { ...set, home_score: 11 } as Set;
    expect(hapticFor(state(aMatch("live"), set), state(aMatch("live"), next))).toBe("tap");
  });

  it("succeeds for the point that completes a set", () => {
    const set = setRow({ id: "set-1", home_score: 24, away_score: 20 });
    const done = { ...set, home_score: 25, status: "completed" } as Set;
    expect(hapticFor(state(aMatch("live"), set), state(aMatch("live"), done))).toBe("success");
  });

  it("succeeds when the current set moves on to another one", () => {
    const set = setRow({ id: "set-1" });
    const following = setRow({ id: "set-2", set_number: 2 });
    expect(hapticFor(state(aMatch("live"), set), state(aMatch("live"), following))).toBe("success");
  });

  it("succeeds for the point that completes the match", () => {
    const set = setRow({ id: "set-1" });
    expect(hapticFor(state(aMatch("live"), set), state(aMatch("completed"), set))).toBe("success");
  });

  it("taps for a stat that changes nothing in the sets", () => {
    const set = setRow({ id: "set-1" });
    expect(hapticFor(state(aMatch("live"), set), state(aMatch("live"), { ...set }))).toBe("tap");
  });

  it("taps when the match was already completed", () => {
    const set = setRow({ id: "set-1", status: "completed" });
    expect(hapticFor(state(aMatch("completed"), set), state(aMatch("completed"), set))).toBe("tap");
  });
});
