import { toTypedRxJsonSchema } from "rxdb";

export type CollectionName =
  | "championships"
  | "match_formats"
  | "seasons"
  | "teams"
  | "team_members"
  | "matches"
  | "sets"
  | "substitutions"
  | "score_points"
  | "player_stats"
  | "events";

const timestampFields = {
  created_at: { type: "string", "format": "date-time", maxLength: 32 },
  updated_at: { type: "string", "format": "date-time", maxLength: 32 },
};

// Championship Schema
export const championshipSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 8 },
    name: { type: "string" },
    type: { type: "string" },
    metadata: { type: "string" },
    default_match_format: { type: "number" },
    format: {
      type: "string",
      enum: ["4x4", "6x6"],
      maxLength: 6,
    },
    age_category: {
      type: "string",
      enum: ["U10", "U12", "U14", "U16", "U18", "U21", "senior"],
      maxLength: 6,
    },
    gender: {
      type: "string",
      enum: ["female", "male"],
      maxLength: 6,
    },
    ...timestampFields,
  },
  required: [
    "id",
    "name",
    "created_at",
    "updated_at",
  ],
  indexes: [
    "created_at",
    "updated_at",
  ],
});

// Season Schema
export const seasonSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
      id: { type: "string", maxLength: 8 },
    name: { type: "string" },
    start_date: { type: "string" },
    end_date: { type: "string" },
    ...timestampFields,
  },
  required: [
    "id",
    "name",
    "created_at",
    "updated_at",
  ],
  indexes: [
    "created_at",
    "updated_at",
  ],
});

// Match Format Schema
export const matchFormatSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 8 },
    description: { type: "string" },
    sets_to_win: { type: "number" },
    rotation: { type: "boolean" },
    point_by_set: { type: "number" },
    point_final_set: { type: "number" },
    decisive_point: { type: "boolean" },
    ...timestampFields,
  },
  required: [
    "id",
    "sets_to_win",
    "rotation",
    "point_by_set",
    "point_final_set",
    "decisive_point", "created_at", "updated_at"
  ],
  indexes: [
    "created_at", "updated_at"
  ],
});

// Team Schema
export const teamSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    name: { type: "string" },
    user_id: { type: "string", maxLength: 36 },
    championship_id: { type: ["number", "null"] },
    ...timestampFields,
  },
  required: ["id", "name", "user_id", "created_at", "updated_at"],
  indexes: ["user_id", "created_at", "updated_at"],
});

// Player Schema
export const playerSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    team_id: { type: "string", maxLength: 36 },
    user_id: { type: ["string", "null"], maxLength: 36 },
    name: { type: "string" },
    number: { type: "number" },
    role: {
      type: "string",
      enum: ["owner", "coach", "staff", "player"],
      default: "player",
    },
    position: { type: "string" },
    comments: { type: ["string", "null"] },
    avatar_url: { type: ["string", "null"] },
    ...timestampFields,
  },
  required: [
    "id",
    "team_id",
    "name",
    "number",
    "role",
    "created_at",
    "updated_at",
  ],
  indexes: ["team_id", "created_at", "updated_at"],
});

// Match Schema
export const matchSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    date: { type: "string" },
    location: { type: ["string", "null"] },
    home_team_id: { type: "string", maxLength: 36 },
    away_team_id: { type: "string", maxLength: 36 },
    home_score: { type: "number" },
    away_score: { type: "number" },
    match_format: { type: "number" },
    season_id: { type: "number" },
    status: {
      type: "string",
      enum: ["upcoming", "live", "completed"],
      maxLength: 10,
    },
    home_available_players: {
      type: "array",
      items: { type: "string", maxLength: 36 },
    },
    away_available_players: {
      type: "array",
      items: { type: "string", maxLength: 36 },
    },
    ...timestampFields,
  },
  required: [
    "id",
    "date",
    "home_team_id",
    "away_team_id",
    "status",
    "created_at",
    "updated_at",
  ],
  indexes: [
    "home_team_id",
    "away_team_id",
    "status",
    "created_at",
    "updated_at",
  ],
});

// Set Schema
export const setSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    set_number: { type: "number" },
    home_score: { type: "number" },
    away_score: { type: "number" },
    status: { type: "string", enum: ["upcoming", "live", "completed"] },
    first_server_team_id: { type: "string", maxLength: 36 },
    server_team_id: { type: "string", maxLength: 36 },
    first_lineup: {
      type: "object",
    },
    current_lineup: {
      type: "object",
    },
    player_roles: {
      type: "object",
    },
    ...timestampFields,
  },
  required: [
    "id",
    "match_id",
    "set_number",
    "status",
    "created_at",
    "updated_at",
  ],
  indexes: ["match_id", "created_at", "updated_at"],
});

// Substitution Schema
export const substitutionSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    team_id: { type: "string", maxLength: 36 },
    set_id: { type: "string", maxLength: 36 },
    player_out_id: { type: "string", maxLength: 36 },
    player_in_id: { type: "string", maxLength: 36 },
    position: { type: "string", enum: ["p1", "p2", "p3", "p4", "p5", "p6"] },
    comments: { type: "string" },
    timestamp: { type: "string" },
    ...timestampFields,
  },
  required: [
    "id",
    "match_id",
    "set_id",
    "player_out_id",
    "player_in_id",
    "position",
    "timestamp",
    "created_at",
    "updated_at",
  ],
  indexes: ["match_id", "set_id", "created_at", "updated_at"],
});

// ScorePoint Schema
export const scorePointSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    set_id: { type: "string", maxLength: 36 },
    player_stat_id: {
      type: ["string", "null"],
      maxLength: 36,
      ref: "player_stats",
    },
    scoring_team_id: { type: "string", maxLength: 36 },
    action_team_id: { type: "string", maxLength: 36 },
    result: { type: "string", enum: ["success", "error"] },
    point_type: {
      type: "string",
      enum: ["serve", "spike", "block", "reception", "defense", "unknown"],
    },
    player_id: { type: ["string", "null"], maxLength: 36 },
    timestamp: { type: "string" },
    home_score: { type: "number" },
    away_score: { type: "number" },
    current_rotation: {
      type: "object",
    },
    ...timestampFields,
  },
  required: [
    "id",
    "match_id",
    "set_id",
    "scoring_team_id",
    "action_team_id",
    "result",
    "point_type",
    "timestamp",
    "home_score",
    "away_score",
    "current_rotation",
    "created_at",
    "updated_at",
  ],
  indexes: ["match_id", "set_id", "created_at", "updated_at"],
});

// PlayerStat Schema
export const playerStatSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    set_id: { type: "string", maxLength: 36 },
    team_id: { type: "string", maxLength: 36 },
    player_id: { type: "string", maxLength: 36 },
    position: {
      type: ["string", "null"],
    },
    stat_type: {
      type: "string",
      enum: ["serve", "spike", "block", "reception", "defense"],
    },
    result: { type: "string", enum: ["success", "error", "good", "bad"] },
    ...timestampFields,
  },
  required: [
    "id",
    "match_id",
    "set_id",
    "team_id",
    "player_id",
    "stat_type",
    "result",
    "created_at",
    "updated_at",
  ],
  indexes: ["match_id", "set_id", "player_id", "created_at", "updated_at"],
});

// Event Schema
export const eventSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    team_id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    set_id: { type: "string", maxLength: 36 },
    home_score: { type: "number" },
    away_score: { type: "number" },
    type: { type: "string" },
    comment: { type: "string" },
    ...timestampFields,
  },
  required: [
    "id",
    "team_id",
    "match_id",
    "set_id",
    "type",
    "created_at",
    "updated_at"
  ],
  indexes: [
    "team_id",
    "match_id",
    "set_id",
    "created_at",
    "updated_at",
  ],
});
