import { toTypedRxJsonSchema } from 'rxdb';
import { RxJsonSchema } from 'rxdb';
import type { Team, Player, Match, Set, PlayerStat, Substitution, ScorePoint } from '@/lib/supabase/types';

export type CollectionName = 'teams' | 'players' | 'matches' | 'sets' | 'substitutions' | 'score_points' | 'player_stats';

const timestampFields = {
  created_at: { type: 'string', "format": "date-time", maxLength: 32 },
  updated_at: { type: 'string', "format": "date-time", maxLength: 32 }
};

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
    position: { type: 'string' },
    avatar_url: { type: ['string', 'null'] },
    ...timestampFields
  },
  required: ['id', 'team_id', 'name', 'number', 'position', 'created_at', 'updated_at'],
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
    available_players: { 
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
    current_lineup: {
      type: 'object',
      properties: {
        position1: { type: 'string', maxLength: 36 },
        position2: { type: 'string', maxLength: 36 },
        position3: { type: 'string', maxLength: 36 },
        position4: { type: 'string', maxLength: 36 },
        position5: { type: 'string', maxLength: 36 },
        position6: { type: 'string', maxLength: 36 },
      },
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
    set_id: { type: 'string', maxLength: 36 },
    player_out_id: { type: 'string', maxLength: 36 },
    player_in_id: { type: 'string', maxLength: 36 },
    position: { type: 'number', minimum: 1, maximum: 6 },
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
    scoring_team: { type: 'string', enum: ['home', 'away'] },
    point_type: { type: 'string', enum: ['serve', 'spike', 'block', 'reception', 'unknown'] },
    player_id: { type: ['string', 'null'], maxLength: 36 },
    timestamp: { type: 'string' },
    home_score: { type: 'number' },
    away_score: { type: 'number' },
    current_rotation: {
      type: 'object',
      properties: {
        position1: { type: 'string', maxLength: 36 },
        position2: { type: 'string', maxLength: 36 },
        position3: { type: 'string', maxLength: 36 },
        position4: { type: 'string', maxLength: 36 },
        position5: { type: 'string', maxLength: 36 },
        position6: { type: 'string', maxLength: 36 },
      },
    },
    ...timestampFields
  },
  required: ['id', 'match_id', 'set_id', 'scoring_team', 'point_type', 'timestamp', 'home_score', 'away_score', 'current_rotation', 'created_at', 'updated_at'],
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
    player_id: { type: 'string', maxLength: 36 },
    stat_type: { type: 'string', enum: ['serve', 'spike', 'block', 'reception'] },
    result: { type: 'string', enum: ['success', 'error', 'attempt'] },
    ...timestampFields
  },
  required: ['id', 'match_id', 'set_id', 'player_id', 'stat_type', 'result', 'created_at', 'updated_at'],
  indexes: ['match_id', 'set_id', 'player_id', 'created_at', 'updated_at']
});