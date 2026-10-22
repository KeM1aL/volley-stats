import { describe, expect, it } from "vitest";
import { canManageMatch, canRemoveMatch } from "@/lib/matches/can-manage-match";
import type { Match, Team, User } from "@/lib/types";

const team = (id: string, clubId: string | null, userId: string | null) => ({ id, club_id: clubId, user_id: userId }) as Team;

const match = {
  id: "m1",
  home_team_id: "home",
  away_team_id: "away",
  home_team: team("home", "club-home", "creator-home"),
  away_team: team("away", "club-away", "creator-away"),
} as Match;

const user = (id: string, extra: Partial<User> = {}) => ({ id, ...extra }) as User;

describe("canManageMatch", () => {
  it("allows the creator of the away team", () => {
    expect(canManageMatch(user("creator-away"), match)).toBe(true);
  });

  it("allows a member of the home team", () => {
    expect(canManageMatch(user("u", { teamMembers: [{ team_id: "home" } as never] }), match)).toBe(true);
  });

  it("allows a club member of the home team's club", () => {
    expect(canManageMatch(user("u", { clubMembers: [{ club_id: "club-home" } as never] }), match)).toBe(true);
  });

  it("refuses an unrelated user and no user", () => {
    expect(canManageMatch(user("other"), match)).toBe(false);
    expect(canManageMatch(null, match)).toBe(false);
  });
});

describe("canRemoveMatch", () => {
  it("allows the creator of either team", () => {
    expect(canRemoveMatch(user("creator-home"), match)).toBe(true);
    expect(canRemoveMatch(user("creator-away"), match)).toBe(true);
  });

  it("refuses a team member who did not create the team", () => {
    expect(canRemoveMatch(user("u", { teamMembers: [{ team_id: "home" } as never] }), match)).toBe(false);
  });

  it("refuses a club member and no user", () => {
    expect(canRemoveMatch(user("u", { clubMembers: [{ club_id: "club-home" } as never] }), match)).toBe(false);
    expect(canRemoveMatch(null, match)).toBe(false);
  });

  it("refuses when the teams are not loaded", () => {
    expect(canRemoveMatch(user("creator-home"), { ...match, home_team: null, away_team: undefined })).toBe(false);
  });
});
