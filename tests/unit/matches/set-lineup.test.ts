import { describe, expect, it } from "vitest";
import { PlayerPosition, PlayerRole } from "@/lib/enums";
import {
  FIELD_ROLES,
  clearPosition,
  defaultFieldRole,
  emptyLineup,
  emptyPositions,
  existingPositions,
  placePlayer,
  positionsMissingRole,
  roleAt,
  setLibero,
  setRole,
  toPlayerRoles,
} from "@/lib/matches/set-lineup";

const { P1, P2, P3, P4, P5, P6 } = PlayerPosition;
const ALL = [P1, P2, P3, P4, P5, P6];

describe("set lineup", () => {
  it("only offers field roles", () => {
    expect(FIELD_ROLES).not.toContain(PlayerRole.LIBERO);
    expect(FIELD_ROLES).toHaveLength(4);
  });

  describe("defaultFieldRole", () => {
    it("maps a field position to its role", () => {
      expect(defaultFieldRole("setter")).toBe(PlayerRole.SETTER);
    });

    it("gives no role for libero, null or an unknown position", () => {
      expect(defaultFieldRole("libero")).toBeNull();
      expect(defaultFieldRole(null)).toBeNull();
      expect(defaultFieldRole(undefined)).toBeNull();
      expect(defaultFieldRole("unknown")).toBeNull();
    });
  });

  describe("placePlayer", () => {
    it("gives the player their default field role", () => {
      const lineup = placePlayer(emptyLineup, P1, "a", "setter");
      expect(lineup.positions[P1]).toBe("a");
      expect(roleAt(lineup, P1)).toBe(PlayerRole.SETTER);
    });

    it("leaves a player whose position is libero without a role on court", () => {
      const lineup = placePlayer(emptyLineup, P3, "lib", "libero");
      expect(lineup.positions[P3]).toBe("lib");
      expect(roleAt(lineup, P3)).toBeNull();
      expect(positionsMissingRole(lineup, ALL)).toContain(P3);
    });

    it("moves a player placed twice, with exactly one roles entry", () => {
      let lineup = placePlayer(emptyLineup, P1, "a", "setter");
      lineup = placePlayer(lineup, P2, "a", "setter");
      expect(lineup.positions[P1]).toBeUndefined();
      expect(lineup.positions[P2]).toBe("a");
      expect(Object.keys(lineup.roles)).toEqual(["a"]);
    });

    it("drops the previous player's role when replacing them", () => {
      let lineup = placePlayer(emptyLineup, P1, "a", "setter");
      lineup = placePlayer(lineup, P1, "b", "opposite");
      expect(lineup.positions[P1]).toBe("b");
      expect(lineup.roles).not.toHaveProperty("a");
      expect(toPlayerRoles(lineup, ALL)).not.toHaveProperty("a");
      expect(roleAt(lineup, P1)).toBe(PlayerRole.OPPOSITE);
    });

    it("clears the libero when the libero is placed on court", () => {
      const withLibero = setLibero(emptyLineup, "lib");
      expect(withLibero.liberoId).toBe("lib");
      const lineup = placePlayer(withLibero, P1, "lib", "libero");
      expect(lineup.liberoId).toBeNull();
    });

    it("does not mutate its input", () => {
      const before = placePlayer(emptyLineup, P1, "a", "setter");
      const snapshot = JSON.stringify(before);
      placePlayer(before, P2, "b", "opposite");
      expect(JSON.stringify(before)).toBe(snapshot);
      expect(emptyLineup).toEqual({ positions: {}, roles: {}, liberoId: null });
    });
  });

  describe("clearPosition", () => {
    it("empties the position and drops the player's role", () => {
      let lineup = placePlayer(emptyLineup, P1, "a", "setter");
      lineup = clearPosition(lineup, P1);
      expect(lineup.positions[P1]).toBeUndefined();
      expect(lineup.roles).toEqual({});
    });
  });

  describe("setRole", () => {
    it("sets the role of the player at the position", () => {
      let lineup = placePlayer(emptyLineup, P3, "lib", "libero");
      lineup = setRole(lineup, P3, PlayerRole.MIDDLE_HITTER);
      expect(roleAt(lineup, P3)).toBe(PlayerRole.MIDDLE_HITTER);
      expect(positionsMissingRole(lineup, ALL)).not.toContain(P3);
    });

    it("rejects the libero role", () => {
      const lineup = placePlayer(emptyLineup, P1, "a", "setter");
      expect(setRole(lineup, P1, PlayerRole.LIBERO)).toEqual(lineup);
    });

    it("does nothing on an empty position", () => {
      expect(setRole(emptyLineup, P1, PlayerRole.SETTER)).toEqual(emptyLineup);
    });
  });

  describe("setLibero", () => {
    it("returns the lineup unchanged for a player on court", () => {
      const lineup = placePlayer(emptyLineup, P1, "a", "setter");
      expect(setLibero(lineup, "a")).toEqual(lineup);
    });

    it("sets and clears the libero", () => {
      const lineup = setLibero(emptyLineup, "lib");
      expect(lineup.liberoId).toBe("lib");
      expect(setLibero(lineup, null).liberoId).toBeNull();
    });
  });

  describe("positionsMissingRole / emptyPositions", () => {
    it("lists positions in the given order, only among existing ones", () => {
      let lineup = placePlayer(emptyLineup, P2, "a", "libero");
      lineup = placePlayer(lineup, P1, "b", "setter");
      lineup = placePlayer(lineup, P5, "c", "libero");
      expect(positionsMissingRole(lineup, [P1, P2, P3, P4])).toEqual([P2]);
      expect(emptyPositions(lineup, [P1, P2, P3, P4])).toEqual([P3, P4]);
    });
  });

  describe("toPlayerRoles", () => {
    it("ignores positions that don't exist and adds the libero", () => {
      let lineup = emptyLineup;
      lineup = placePlayer(lineup, P1, "a", "setter");
      lineup = placePlayer(lineup, P2, "b", "opposite");
      lineup = placePlayer(lineup, P3, "c", "outside_hitter");
      lineup = placePlayer(lineup, P4, "d", "middle_hitter");
      lineup = placePlayer(lineup, P5, "e", "setter");
      lineup = setLibero(lineup, "lib");
      expect(toPlayerRoles(lineup, existingPositions("4x4"))).toEqual({
        a: PlayerRole.SETTER,
        b: PlayerRole.OPPOSITE,
        c: PlayerRole.OUTSIDE_HITTER,
        d: PlayerRole.MIDDLE_HITTER,
        lib: PlayerRole.LIBERO,
      });
    });

    it("leaves out players without a role", () => {
      const lineup = placePlayer(emptyLineup, P1, "lib", "libero");
      expect(toPlayerRoles(lineup, ALL)).toEqual({});
    });
  });

  describe("existingPositions", () => {
    it("returns the positions of each format", () => {
      expect(existingPositions("2x2")).toEqual([P1, P2]);
      expect(existingPositions("3x3")).toEqual([P1, P2, P3]);
      expect(existingPositions("4x4")).toEqual([P1, P2, P3, P4]);
      expect(existingPositions("6x6")).toEqual(ALL);
    });
  });
});
