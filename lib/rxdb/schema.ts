import { toTypedRxJsonSchema } from "rxdb";

export type CollectionName =
  | "championships"
  | "match_formats"
  | "seasons"
  | "teams"
  | "team_members"
  | "matches"
  | "sets"
  | "score_points"
  | "player_stats"
  | "events"
  | "clubs"
  | "club_members";

const timestampFields = {
  created_at: { type: "string", "format": "date-time", maxLength: 32/*, final: true */},
  updated_at: { type: "string", "format": "date-time", maxLength: 32 },
  _deleted: { type: "boolean" }
};

// Championship Schema
export const championshipSchema = toTypedRxJsonSchema({
  version: 0, // Incremented: Removed format field (moved to match_formats)
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 }, // UUID
    name: { type: "string" },
    type: { type: "string" },
    season_id: { type: ["string", "null"], maxLength: 36 }, // UUID
    default_match_format: { type: "string", maxLength: 36 }, // UUID
    age_category: {
      type: "string",
      enum: ["U10", "U12", "U14", "U16", "U18", "U21", "senior"],
      maxLength: 6,
    },
    gender: {
      type: "string",
      enum: ["female", "male", "mixte"],
      maxLength: 6,
    },
    ext_code: { type: ["string", "null"] },
    ext_source: { type: ["string", "null"] },
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
  version: 0, // Incremented: Changed ID from integer to UUID string
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 }, // UUID
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
  version: 0, // Incremented: Added format field (moved from championships)
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 }, // UUID
    description: { type: ["string", "null"] },
    format: {
      type: "string",
      enum: ["2x2", "3x3", "4x4", "6x6"],
      maxLength: 6,
    },
    sets_to_win: { type: "number" },
    rotation: { type: "boolean" },
    point_by_set: { type: "number" },
    point_final_set: { type: "number" },
    decisive_point: { type: "boolean" },
    ...timestampFields,
  },
  required: [
    "id",
    "format",
    "sets_to_win",
    "rotation",
    "point_by_set",
    "point_final_set",
    "decisive_point", 
    "created_at", 
    "updated_at"
  ],
  indexes: [
    "created_at", 
    "updated_at"
  ],
});

// Team Schema
export const teamSchema = toTypedRxJsonSchema({
  version: 0, // Incremented: Changed championship_id foreign key from integer to UUID string
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 }, // UUID
    name: { type: "string" },
    user_id: { type: ["string", "null"], maxLength: 36 },
    club_id: { type: ["string", "null"], maxLength: 36 },
    championship_id: { type: ["string", "null"], maxLength: 36 }, // UUID
    ext_code: { type: ["string", "null"] },
    ext_source: { type: ["string", "null"] },
    ...timestampFields,
  },
  required: ["id", "name",  "created_at", "updated_at"],
  indexes: ["created_at", "updated_at"],
});

// Club Schema
export const clubSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    name: { type: "string" },
    user_id: { type: "string", maxLength: 36 },
    website: { type: ["string", "null"] },
    contact_email: { type: ["string", "null"] },
    contact_phone: { type: ["string", "null"] },
    ...timestampFields,
  },
  required: ["id", "name", "user_id", "created_at", "updated_at"],
  indexes: ["user_id", "created_at", "updated_at"],
});

// Club Member Schema
export const clubMemberSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    club_id: { type: "string", maxLength: 36 },
    user_id: { type: "string", maxLength: 36 },
    role: {
      type: "string",
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    ...timestampFields,
  },
  required: ["id", "club_id", "user_id", "role", "created_at", "updated_at"],
  indexes: ["club_id", "user_id", "created_at", "updated_at"],
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
    number: { type: ["number", "null"] },
    role: {
      type: "string",
      enum: ["owner", "coach", "staff", "player"],
      default: "player",
    },
    position: { type: ["string", "null"] },
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
  version: 0, // Incremented: Changed championship_id, season_id, match_format_id foreign keys from integer to UUID string
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    date: { type: "string" },
    location: { type: ["string", "null"] },
    home_team_id: { type: "string", maxLength: 36 },
    away_team_id: { type: "string", maxLength: 36 },
    championship_id: { type: ["string", "null"], maxLength: 36 }, // UUID
    season_id: { type: ["string", "null"], maxLength: 36 }, // UUID
    home_score: { type: ["number", "null"] },
    away_score: { type: ["number", "null"] },
    match_format_id: { type: "string", maxLength: 36 }, // UUID
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
    ext_code: { type: ["string", "null"] },
    ext_source: { type: ["string", "null"] },
    home_total: { type: ["number", "null"] },
    away_total: { type: ["number", "null"] },
    detailed_scores: { type: ["array", "null"], items: { type: "string" } },
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

// ScorePoint Schema
export const scorePointSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    set_id: { type: "string", maxLength: 36 },
    point_number: { type: "number", minimum: 1, maximum: 1000 },
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
    "point_number",
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

// Event Schema - Enhanced for comprehensive event tracking
export const eventSchema = toTypedRxJsonSchema({
  version: 0, // Incremented: Enhanced schema for unified event system
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    set_id: { type: ["string", "null"], maxLength: 36 }, // Nullable for match-level events
    team_id: { type: ["string", "null"], maxLength: 36 }, // Nullable for non-team events
    event_type: {
      type: "string",
      enum: ["substitution", "timeout", "injury", "sanction", "technical", "comment"],
      maxLength: 20,
    },
    timestamp: { type: "string", format: "date-time", maxLength: 32 },
    team: {
      type: ["string", "null"],
      enum: ["home", "away", null],
      maxLength: 10,
    },
    player_id: { type: ["string", "null"], maxLength: 36 }, // Player involved in event
    comment: { type: ["string", "null"] }, // General comment at column level
    details: { type: "object" }, // Flexible JSON for event-specific data
    home_score: { type: ["number", "null"] }, // Home team score when event occurred
    away_score: { type: ["number", "null"] }, // Away team score when event occurred
    point_number: { type: ["number", "null"] }, // Point number in set when event occurred
    ...timestampFields,
  },
  required: [
    "id",
    "match_id",
    "event_type",
    "timestamp",
    "created_at",
    "updated_at"
  ],
  indexes: [
    "event_type",
    "match_id",
    ["match_id", "timestamp"], // Composite index for efficient timeline queries
    "created_at",
    "updated_at",
  ],
});
