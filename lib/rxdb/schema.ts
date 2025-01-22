import { toTypedRxJsonSchema } from 'rxdb';

export type CollectionName = 'teams' | 'players' | 'matches' | 'sets' | 'substitutions' | 'score_points' | 'player_stats';

const timestampFields = {
  created_at: { type: 'string', "format": "date-time", maxLength: 32 },
  updated_at: { type: 'string', "format": "date-time", maxLength: 32 }
};

export const checkpointSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'collection_name',
  type: 'object',
  properties: {
    collection_name: { type: 'string', maxLength: 20 },
    updated_at: { type: 'string', "format": "date-time", maxLength: 32 }
  },
  required: ['collection_name', 'updated_at'],
  indexes: ['updated_at']
});

// Team Schema
export const teamSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    name: { type: 'string' },
    user_id: { type: 'string', maxLength: 36 },
    ...timestampFields
  },
  required: ['id', 'name', 'user_id', 'created_at', 'updated_at'],
  indexes: ['user_id', 'created_at', 'updated_at']
});

// Player Schema
export const playerSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    team_id: { type: 'string', maxLength: 36 },
    name: { type: 'string' },
    number: { type: 'number' },
    role: { type: 'string' },
    avatar_url: { type: ['string', 'null'] },
    ...timestampFields
  },
  required: ['id', 'team_id', 'name', 'number', 'role', 'created_at', 'updated_at'],
  indexes: ['team_id', 'created_at', 'updated_at']
});

// Match Schema
export const matchSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    date: { type: 'string' },
    location: { type: ['string', 'null'] },
    home_team_id: { type: 'string', maxLength: 36 },
    away_team_id: { type: 'string', maxLength: 36 },
    home_score: { type: 'number' },
    away_score: { type: 'number' },
    status: { type: 'string', enum: ['upcoming', 'live', 'completed'], maxLength: 10 },
    home_available_players: {
      type: 'array',
      items: { type: 'string', maxLength: 36 }
    },
    away_available_players: {
      type: 'array',
      items: { type: 'string', maxLength: 36 }
    },
    ...timestampFields
  },
  required: ['id', 'date', 'home_team_id', 'away_team_id', 'status', 'created_at', 'updated_at'],
  indexes: ['home_team_id', 'away_team_id', 'status', 'created_at', 'updated_at']
});

// Set Schema
export const setSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    match_id: { type: 'string', maxLength: 36 },
    set_number: { type: 'number' },
    home_score: { type: 'number' },
    away_score: { type: 'number' },
    status: { type: 'string', enum: ['upcoming', 'live', 'completed'] },
    first_server_team_id: { type: 'string', maxLength: 36 },
    server_team_id: { type: 'string', maxLength: 36 },
    first_lineup: {
      type: 'object'
    },
    current_lineup: {
      type: 'object'
    },
    player_roles: {
      type: 'object'
    },
    ...timestampFields
  },
  required: ['id', 'match_id', 'set_number', 'status', 'created_at', 'updated_at'],
  indexes: ['match_id', 'created_at', 'updated_at']
});

// Substitution Schema
export const substitutionSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    match_id: { type: 'string', maxLength: 36 },
    team_id: { type: 'string', maxLength: 36 },
    set_id: { type: 'string', maxLength: 36 },
    player_out_id: { type: 'string', maxLength: 36 },
    player_in_id: { type: 'string', maxLength: 36 },
    position: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    comments: { type: 'string' },
    timestamp: { type: 'string' },
    ...timestampFields
  },
  required: ['id', 'match_id', 'set_id', 'player_out_id', 'player_in_id', 'position', 'timestamp', 'created_at', 'updated_at'],
  indexes: ['match_id', 'set_id', 'created_at', 'updated_at']
});

// ScorePoint Schema
export const scorePointSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    match_id: { type: 'string', maxLength: 36 },
    set_id: { type: 'string', maxLength: 36 },
    player_stat_id: { type: ['string', 'null'], maxLength: 36, ref: 'player_stats' },
    scoring_team_id: { type: 'string', maxLength: 36 },
    action_team_id: { type: 'string', maxLength: 36 },
    result: { type: 'string', enum: ['success', 'error'] },
    point_type: { type: 'string', enum: ['serve', 'spike', 'block', 'reception', 'defense', 'unknown'] },
    player_id: { type: ['string', 'null'], maxLength: 36 },
    timestamp: { type: 'string' },
    home_score: { type: 'number' },
    away_score: { type: 'number' },
    current_rotation: {
      type: 'object'
    },
    ...timestampFields
  },
  required: ['id', 'match_id', 'set_id', 'scoring_team_id', 'action_team_id', 'result', 'point_type', 'timestamp', 'home_score', 'away_score', 'current_rotation', 'created_at', 'updated_at'],
  indexes: ['match_id', 'set_id', 'created_at', 'updated_at']
});

// PlayerStat Schema
export const playerStatSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    match_id: { type: 'string', maxLength: 36 },
    set_id: { type: 'string', maxLength: 36 },
    team_id: { type: 'string', maxLength: 36 },
    player_id: { type: 'string', maxLength: 36 },
    position: { type: 'string', enum: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    stat_type: { type: 'string', enum: ['serve', 'spike', 'block', 'reception', 'defense'] },
    result: { type: 'string', enum: ['success', 'error', 'good', 'bad'] },
    ...timestampFields
  },
  required: ['id', 'match_id', 'set_id', 'team_id', 'player_id', 'stat_type', 'position', 'result', 'created_at', 'updated_at'],
  indexes: ['match_id', 'set_id', 'player_id', 'created_at', 'updated_at']
});