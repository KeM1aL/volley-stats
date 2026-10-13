import { describe, expect, it } from "vitest";
import { latePlayerCandidates, withLatePlayer } from "@/lib/matches/late-players";
import type { TeamMember } from "@/lib/types";

const member = (id: string, number: number, fields: Partial<TeamMember> = {}): TeamMember => ({
  id,
  team_id: "team",
  name: `Player ${number}`,
  number,
  position: null,
  role: "player",
  ...fields,
});

describe("latePlayerCandidates", () => {
  it("offers active members who aren't in the roster, by jersey number", () => {
    const members = [member("c", 9), member("a", 3), member("b", 7), member("in", 1)];
    expect(latePlayerCandidates(members, ["in"]).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("leaves archived members out", () => {
    const members = [member("a", 3, { archived_at: "2026-10-13T10:00:00.000Z" }), member("b", 7, { archived_at: null })];
    expect(latePlayerCandidates(members, []).map((m) => m.id)).toEqual(["b"]);
  });

  it("is empty when everyone is already in the roster", () => {
    expect(latePlayerCandidates([member("a", 3)], ["a"])).toEqual([]);
    expect(latePlayerCandidates([], [])).toEqual([]);
  });
});

describe("withLatePlayer", () => {
  it("appends the player", () => {
    expect(withLatePlayer(["a"], "b")).toEqual(["a", "b"]);
  });

  it("adds a player once, however often it is called", () => {
    expect(withLatePlayer(withLatePlayer(["a"], "b"), "b")).toEqual(["a", "b"]);
  });

  it("starts a roster that doesn't exist yet", () => {
    expect(withLatePlayer(null, "b")).toEqual(["b"]);
    expect(withLatePlayer(undefined, "b")).toEqual(["b"]);
  });

  it("doesn't change the roster it was given", () => {
    const roster = ["a"];
    withLatePlayer(roster, "b");
    expect(roster).toEqual(["a"]);
  });
});
