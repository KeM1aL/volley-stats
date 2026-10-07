import { randomUUID } from "node:crypto";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";

export const USER_ID = "user-1";
export const HOME_TEAM_ID = "10000000-0000-4000-8000-000000000001";
export const AWAY_TEAM_ID = "10000000-0000-4000-8000-000000000002";
export const PLAYER_ID = "10000000-0000-4000-8000-000000000003";
export const FORMAT_ID = "10000000-0000-4000-8000-000000000004";

const nowIso = () => new Date().toISOString();

export function seedTeams(server: FakeSupabaseServer): void {
  server.seed("teams", { id: HOME_TEAM_ID, name: "Home", status: "active", user_id: USER_ID });
  server.seed("teams", { id: AWAY_TEAM_ID, name: "Away", status: "active", user_id: null });
  server.seed("team_members", { id: PLAYER_ID, team_id: HOME_TEAM_ID, name: "Player 7", number: 7, role: "player" });
}

export function seedServerMatch(server: FakeSupabaseServer, overrides: Record<string, unknown> = {}): string {
  const id = randomUUID();
  server.seed("matches", {
    id,
    date: nowIso(),
    home_team_id: HOME_TEAM_ID,
    away_team_id: AWAY_TEAM_ID,
    match_format_id: FORMAT_ID,
    status: "live",
    home_score: 0,
    away_score: 0,
    home_available_players: [PLAYER_ID],
    away_available_players: [],
    ...overrides,
  });
  return id;
}

export function aSet(matchId: string, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_number: 1,
    home_score: 0,
    away_score: 0,
    status: "live",
    first_server_team_id: HOME_TEAM_ID,
    server_team_id: HOME_TEAM_ID,
    first_lineup: { p1: PLAYER_ID },
    current_lineup: { p1: PLAYER_ID },
    player_roles: {},
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}

export function aPlayerStat(matchId: string, setId: string, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_id: setId,
    team_id: HOME_TEAM_ID,
    player_id: PLAYER_ID,
    position: null,
    stat_type: "spike",
    result: "success",
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}

export function aScorePoint(matchId: string, setId: string, pointNumber: number, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_id: setId,
    point_number: pointNumber,
    player_stat_id: null,
    scoring_team_id: HOME_TEAM_ID,
    action_team_id: HOME_TEAM_ID,
    result: "success",
    point_type: "spike",
    player_id: PLAYER_ID,
    timestamp: t,
    home_score: pointNumber,
    away_score: 0,
    current_rotation: { p1: PLAYER_ID },
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}

export function anEvent(matchId: string, setId: string | null, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_id: setId,
    team_id: HOME_TEAM_ID,
    event_type: "comment",
    timestamp: t,
    team: "home",
    player_id: null,
    comment: "note",
    details: {},
    home_score: 0,
    away_score: 0,
    point_number: null,
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}
