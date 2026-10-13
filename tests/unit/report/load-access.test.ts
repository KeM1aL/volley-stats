import { beforeEach, describe, expect, it } from "vitest";
import { checkReportAccess } from "@/lib/report/access";
import { canExportForTeam } from "@/lib/report/can-export";
import { loadMatchReportData, ReportNotFoundError } from "@/lib/report/load";
import type { TeamMember } from "@/lib/types";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";

const HOME = "team-home";
const AWAY = "team-away";
const MATCH = "match-1";
const OLD = "2026-10-01T10:00:00.000000+00:00";
const NEW = "2026-10-02T10:00:00.000000+00:00";

let server: FakeSupabaseServer;

function seedMatch(): void {
  server.seedAt("match_formats", { id: "fmt", format: "6x6", sets_to_win: 3, rotation: true, point_by_set: 25, point_final_set: 15, decisive_point: false, description: null }, OLD);
  server.seedAt("teams", { id: HOME, name: "Volley Club", status: "active", user_id: "creator", club_id: "club-1" }, OLD);
  server.seedAt("teams", { id: AWAY, name: "Les Rivales", status: "active", user_id: null, club_id: null }, OLD);
  server.seedAt("championships", { id: "champ", name: "Régionale U18" }, OLD);
  server.seedAt("matches", { id: MATCH, date: OLD, home_team_id: HOME, away_team_id: AWAY, match_format_id: "fmt", championship_id: "champ", status: "completed", location: null }, OLD);
  server.seedAt("team_members", { id: "player-1", team_id: HOME, name: "Alice", number: 1, role: "player", user_id: "member" }, OLD);
  server.seedAt("team_members", { id: "player-gone", team_id: HOME, name: "Gone but scored", number: 9, role: "player", _deleted: true }, OLD);
  server.seedAt("team_members", { id: "player-unused", team_id: HOME, name: "Gone", number: 8, role: "player", _deleted: true }, OLD);
  server.seedAt("team_members", { id: "member-deleted", team_id: HOME, name: "Left", number: 7, role: "player", user_id: "left", _deleted: true }, OLD);
  server.seedAt("sets", { id: "set-1", match_id: MATCH, set_number: 1, home_score: 1, away_score: 0, status: "completed", first_server_team_id: HOME, server_team_id: HOME, first_lineup: { p1: "player-1" }, current_lineup: { p1: "player-1" }, player_roles: {} }, OLD);
  server.seedAt("score_points", { id: "point-1", match_id: MATCH, set_id: "set-1", point_number: 1, scoring_team_id: HOME, action_team_id: HOME, point_type: "spike", result: "success", player_id: "player-gone", player_stat_id: null, timestamp: OLD, home_score: 1, away_score: 0, current_rotation: { p1: "player-1" } }, OLD);
  server.seedAt("player_stats", { id: "stat-1", match_id: MATCH, set_id: "set-1", player_id: "player-gone", team_id: HOME, position: "p4", stat_type: "spike", result: "success" }, OLD);
  server.seedAt("player_stats", { id: "stat-deleted", match_id: MATCH, set_id: "set-1", player_id: "player-1", team_id: HOME, position: null, stat_type: "serve", result: "error", _deleted: true }, OLD);
  server.seedAt("events", { id: "event-1", match_id: MATCH, set_id: "set-1", event_type: "timeout", timestamp: OLD, team: "home", details: {} }, OLD);
  server.seedAt("club_members", { id: "cm-owner", club_id: "club-1", user_id: "club-owner", role: "owner" }, OLD);
  server.seedAt("club_members", { id: "cm-admin", club_id: "club-1", user_id: "club-admin", role: "admin" }, OLD);
  server.seedAt("club_members", { id: "cm-member", club_id: "club-1", user_id: "club-member", role: "member" }, OLD);
}

beforeEach(() => {
  server = createFakeServer();
  seedMatch();
});

describe("loadMatchReportData", () => {
  it("loads the match without deleted rows, keeping removed players the match references", async () => {
    const { data } = await loadMatchReportData(server.client(), MATCH);
    expect(data.homeTeam.name).toBe("Volley Club");
    expect(data.championshipName).toBe("Régionale U18");
    expect(data.stats.map((s) => s.id)).toEqual(["stat-1"]);
    expect(data.members.map((m) => m.id).sort()).toEqual(["player-1", "player-gone"]);
    expect(data.sets).toHaveLength(1);
    expect(data.points).toHaveLength(1);
    expect(data.events).toHaveLength(1);
  });

  it("changes lastModified when a row is soft-deleted", async () => {
    const before = (await loadMatchReportData(server.client(), MATCH)).lastModified;
    expect(before).toBe(OLD);
    server.editAsWebsite("score_points", "point-1", { _deleted: true });
    const after = (await loadMatchReportData(server.client(), MATCH)).lastModified;
    expect(after).not.toBe(before);
  });

  it("uses the latest change of any row", async () => {
    server.seedAt("events", { id: "event-2", match_id: MATCH, set_id: null, event_type: "comment", timestamp: NEW, details: {} }, NEW);
    expect((await loadMatchReportData(server.client(), MATCH)).lastModified).toBe(NEW);
  });

  it("fails loudly when a list reaches the 1000-row request cap", async () => {
    for (let i = 0; i < 1000; i++) {
      server.seedAt("events", { id: `bulk-${i}`, match_id: MATCH, set_id: null, event_type: "comment", timestamp: OLD, details: {} }, OLD);
    }
    await expect(loadMatchReportData(server.client(), MATCH)).rejects.toThrow("tooManyRows");
  });

  it("throws ReportNotFoundError for an unknown match", async () => {
    await expect(loadMatchReportData(server.client(), "nope")).rejects.toBeInstanceOf(ReportNotFoundError);
  });
});

describe("checkReportAccess", () => {
  const check = (userId: string, teamId = HOME, matchId = MATCH) => checkReportAccess(server.client(), userId, matchId, teamId);

  it("allows team members, the team's creator and club owners/admins", async () => {
    expect(await check("member")).toBe("allowed");
    expect(await check("creator")).toBe("allowed");
    expect(await check("club-owner")).toBe("allowed");
    expect(await check("club-admin")).toBe("allowed");
  });

  it("refuses club members without a role, removed members and strangers", async () => {
    expect(await check("club-member")).toBe("forbidden");
    expect(await check("left")).toBe("forbidden");
    expect(await check("stranger")).toBe("forbidden");
    expect(await check("member", AWAY)).toBe("forbidden");
  });

  it("tells a missing match from a team that did not play it", async () => {
    expect(await check("member", HOME, "nope")).toBe("match-not-found");
    expect(await check("member", "team-other")).toBe("team-not-in-match");
  });
});

describe("canExportForTeam", () => {
  const team = { id: HOME, user_id: "creator", club_id: "club-1" };
  const membership = (fields: Partial<TeamMember> & { _deleted?: boolean } = {}): TeamMember => ({
    id: "tm-1",
    team_id: HOME,
    name: "",
    number: 1,
    position: null,
    role: "player",
    ...fields,
  });

  it("mirrors the server rule on the signed-in user's memberships", () => {
    expect(canExportForTeam(null, team)).toBe(false);
    expect(canExportForTeam({ id: "creator" }, team)).toBe(true);
    expect(canExportForTeam({ id: "member", teamMembers: [membership({})] }, team)).toBe(true);
    expect(canExportForTeam({ id: "member", teamMembers: [membership({ _deleted: true })] }, team)).toBe(false);
    expect(canExportForTeam({ id: "admin", clubMembers: [{ id: "cm", club_id: "club-1", user_id: "admin", role: "admin" }] }, team)).toBe(true);
  });

  it("ignores the club-team entries the profile adds for every club member", () => {
    // lib/api/users.ts adds one entry per club team with id === team_id and the club role.
    const clubEntry = membership({ id: HOME, role: "member" });
    const user = { id: "club-member", teamMembers: [clubEntry], clubMembers: [{ id: "cm", club_id: "club-1", user_id: "club-member", role: "member" as const }] };
    expect(canExportForTeam(user, team)).toBe(false);
  });
});
