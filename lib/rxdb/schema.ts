import { toTypedRxJsonSchema } from 'rxdb';
import type { RxJsonSchema } from 'rxdb';
import type { Team, Player, Match, Set, PlayerStat } from '@/lib/supabase/types';

// Team Schema
export const teamSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36  },
    name: { type: 'string' },
    user_id: { type: 'string', maxLength: 36 },
    created_at: { type: 'string' },
  },
  required: ['id', 'name', 'user_id', 'created_at'],
  indexes: ['user_id'],
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
    created_at: { type: 'string' },
  },
  required: ['id', 'team_id', 'name', 'number', 'position', 'created_at'],
  indexes: ['team_id'],
});

// Match Schema
export const matchSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    date: { type: 'string' },
    home_team_id: { type: 'string', maxLength: 36 },
    away_team_id: { type: 'string', maxLength: 36 },
    home_score: { type: 'number' },
    away_score: { type: 'number' },
    status: { type: 'string', enum: ['upcoming', 'live', 'completed'], maxLength: 10 },
    created_at: { type: 'string' },
  },
  required: ['id', 'date', 'home_team_id', 'away_team_id', 'status', 'created_at'],
  indexes: ['home_team_id', 'away_team_id', 'status'],
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
  },
  required: ['id', 'match_id', 'set_number', 'status'],
  indexes: ['match_id'],
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
    stat_type: { type: 'string', enum: ['serve', 'attack', 'block', 'reception'] },
    result: { type: 'string', enum: ['success', 'error', 'attempt'] },
    created_at: { type: 'string' },
  },
  required: ['id', 'match_id', 'set_id', 'player_id', 'stat_type', 'result', 'created_at'],
  indexes: ['match_id', 'set_id', 'player_id'],
});