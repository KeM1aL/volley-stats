import {
  championshipSchema,
  clubMemberSchema,
  clubSchema,
  eventSchema,
  matchFormatSchema,
  matchSchema,
  playerSchema,
  playerStatSchema,
  scorePointSchema,
  seasonSchema,
  setSchema,
  teamSchema,
} from "@/lib/rxdb/schema";
import { FakeSupabaseServer, type ForeignKey } from "../fakes/fake-supabase";

const SCHEMAS: Record<string, { properties: Record<string, unknown> }> = {
  championships: championshipSchema,
  seasons: seasonSchema,
  match_formats: matchFormatSchema,
  clubs: clubSchema,
  club_members: clubMemberSchema,
  teams: teamSchema,
  team_members: playerSchema,
  matches: matchSchema,
  sets: setSchema,
  score_points: scorePointSchema,
  player_stats: playerStatSchema,
  events: eventSchema,
};

export const SCORER_COLUMNS = [
  "scorer_device_id",
  "scorer_user_id",
  "scorer_name",
  "scorer_device_label",
  "scorer_claimed_at",
];

/** The real foreign keys of the match tables (spec, "Verification findings"). */
export const FOREIGN_KEYS: ForeignKey[] = [
  { table: "sets", column: "match_id", refTable: "matches" },
  { table: "sets", column: "server_team_id", refTable: "teams" },
  { table: "sets", column: "first_server_team_id", refTable: "teams" },
  { table: "player_stats", column: "match_id", refTable: "matches" },
  { table: "player_stats", column: "set_id", refTable: "sets" },
  { table: "player_stats", column: "player_id", refTable: "team_members" },
  { table: "player_stats", column: "team_id", refTable: "teams" },
  { table: "score_points", column: "match_id", refTable: "matches" },
  { table: "score_points", column: "set_id", refTable: "sets" },
  { table: "score_points", column: "player_id", refTable: "team_members" },
  { table: "score_points", column: "scoring_team_id", refTable: "teams" },
  { table: "score_points", column: "action_team_id", refTable: "teams" },
  { table: "events", column: "match_id", refTable: "matches" },
  { table: "events", column: "set_id", refTable: "sets" },
  { table: "events", column: "player_id", refTable: "team_members" },
  { table: "events", column: "team_id", refTable: "teams" },
];

export function createFakeServer(): FakeSupabaseServer {
  const tables: Record<string, string[]> = {};
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    tables[name] = [...Object.keys(schema.properties), "_modified", ...(name === "matches" ? SCORER_COLUMNS : [])];
  }
  return new FakeSupabaseServer({
    tables,
    foreignKeys: FOREIGN_KEYS,
    scorerTables: ["sets", "score_points", "player_stats", "events"],
  });
}
