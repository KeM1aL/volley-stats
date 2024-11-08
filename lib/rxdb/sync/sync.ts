"use client";

import { supabase } from '@/lib/supabase/client';
import { getDatabase } from '../database';
import type { Team, Player, Match, Set, PlayerStat, Substitution, ScorePoint } from '@/lib/supabase/types';

export async function syncData() {
  const db = await getDatabase();

  // Sync teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*');
  
  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
  } else {
    await Promise.all(
      teams.map((team: Team) =>
        db.teams.upsert(team)
      )
    );
  }

  // Sync players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*');
  
  if (playersError) {
    console.error('Error fetching players:', playersError);
  } else {
    await Promise.all(
      players.map((player: Player) =>
        db.players.upsert(player)
      )
    );
  }

  // Sync matches
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*');
  
  if (matchesError) {
    console.error('Error fetching matches:', matchesError);
  } else {
    await Promise.all(
      matches.map((match: Match) =>
        db.matches.upsert(match)
      )
    );
  }

  // Sync sets
  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('*');
  
  if (setsError) {
    console.error('Error fetching sets:', setsError);
  } else {
    await Promise.all(
      sets.map((set: Set) =>
        db.sets.upsert(set)
      )
    );
  }

  // Sync substitutions
  const { data: substitutions, error: substitutionsError } = await supabase
    .from('substitutions')
    .select('*');
  
  if (substitutionsError) {
    console.error('Error fetching substitutions:', substitutionsError);
  } else {
    await Promise.all(
      substitutions.map((substitution: Substitution) =>
        db.substitutions.upsert(substitution)
      )
    );
  }

  // Sync score points
  const { data: scorePoints, error: scorePointsError } = await supabase
    .from('score_points')
    .select('*');
  
  if (scorePointsError) {
    console.error('Error fetching score points:', scorePointsError);
  } else {
    await Promise.all(
      scorePoints.map((point: ScorePoint) =>
        db.score_points.upsert(point)
      )
    );
  }

    // Sync player stats
    const { data: stats, error: statsError } = await supabase
    .from('player_stats')
    .select('*');
  
  if (statsError) {
    console.error('Error fetching player stats:', statsError);
  } else {
    await Promise.all(
      stats.map((stat: PlayerStat) =>
        db.player_stats.upsert(stat)
      )
    );
  }
}