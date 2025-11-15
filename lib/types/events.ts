/**
 * Event Types for Match Event Tracking System
 *
 * This module defines the types for the unified events system that tracks
 * all significant occurrences during a volleyball match including:
 * - Substitutions
 * - Timeouts
 * - Injuries
 * - Sanctions/Cards
 * - Technical issues
 * - Comments/Notes
 */

import type { Event } from '../types';

/**
 * Supported event types in the system
 */
export type EventType =
  | 'substitution'
  | 'timeout'
  | 'injury'
  | 'sanction'
  | 'technical'
  | 'comment';

/**
 * Team designation for events
 */
export type EventTeam = 'home' | 'away' | null;

/**
 * Base type for all match events (imported from global types)
 * Extended with typed details field for better type safety
 */
export type MatchEvent = Omit<Event, 'details'> & {
  details: EventDetails; // Strongly-typed JSON for event-specific data
};

/**
 * Union type for all possible event detail structures
 */
export type EventDetails =
  | SubstitutionDetails
  | TimeoutDetails
  | InjuryDetails
  | SanctionDetails
  | TechnicalDetails
  | CommentDetails;

/**
 * Substitution Event Details
 * Tracks player substitutions during a set
 */
export type SubstitutionDetails= {
  player_in_id: string; // Player entering the court
  player_out_id: string; // Player leaving the court
  position?: string; // Court position (p1-p6)
  comments?: string; // Additional notes about the substitution
  substitution_id?: string; // Reference to original substitution record (for migrated data)
  migrated?: boolean; // Flag indicating if this was migrated from substitutions table
}

/**
 * Timeout Event Details
 * Tracks team timeouts
 */
export type TimeoutDetails= {
  duration: number; // Duration in seconds (typically 30 or 60)
  timeout_type?: 'regular' | 'technical'; // Type of timeout
  requested_by?: string; // Coach/player name who requested
  comments?: string;
}

/**
 * Injury Event Details
 * Tracks player injuries and medical interventions
 */
export type InjuryDetails= {
  severity: 'minor' | 'moderate' | 'severe';
  body_part?: string; // Affected body part
  description: string; // Description of the injury
  medical_intervention: boolean; // Whether medical staff intervened
  player_continued: boolean; // Whether player continued playing
  substitution_made: boolean; // Whether substitution occurred due to injury
  comments?: string;
}

/**
 * Sanction Event Details
 * Tracks penalties, warnings, and cards
 */
export type SanctionDetails= {
  sanction_type: 'warning' | 'yellow_card' | 'red_card' | 'disqualification';
  target: 'player' | 'coach' | 'staff'; // Who received the sanction
  target_name?: string; // Name of the person sanctioned
  reason: string; // Reason for the sanction
  point_penalty: boolean; // Whether a point was awarded to opponent
  comments?: string;
}

/**
 * Technical Issue Event Details
 * Tracks technical problems or disruptions
 */
export type TechnicalDetails= {
  issue_type: 'equipment' | 'facility' | 'score_dispute' | 'other';
  description: string;
  affected_team?: EventTeam; // Which team was affected (if any)
  resolution_time?: number; // Time taken to resolve (in minutes)
  resolved: boolean;
  comments?: string;
}

/**
 * Comment/Note Event Details
 * Free-form notes and observations
 */
export type CommentDetails= {
  text: string; // The comment text
  author?: string; // Who made the comment
  importance?: 'low' | 'medium' | 'high'; // Importance level
  category?: string; // Optional categorization (strategy, performance, etc.)
}

/**
 * Type guard to check if event is a substitution
 */
export function isSubstitutionEvent(event: MatchEvent): event is MatchEvent & { details: SubstitutionDetails } {
  return event.event_type === 'substitution';
}

/**
 * Type guard to check if event is a timeout
 */
export function isTimeoutEvent(event: MatchEvent): event is MatchEvent & { details: TimeoutDetails } {
  return event.event_type === 'timeout';
}

/**
 * Type guard to check if event is an injury
 */
export function isInjuryEvent(event: MatchEvent): event is MatchEvent & { details: InjuryDetails } {
  return event.event_type === 'injury';
}

/**
 * Type guard to check if event is a sanction
 */
export function isSanctionEvent(event: MatchEvent): event is MatchEvent & { details: SanctionDetails } {
  return event.event_type === 'sanction';
}

/**
 * Type guard to check if event is a technical issue
 */
export function isTechnicalEvent(event: MatchEvent): event is MatchEvent & { details: TechnicalDetails } {
  return event.event_type === 'technical';
}

/**
 * Type guard to check if event is a comment
 */
export function isCommentEvent(event: MatchEvent): event is MatchEvent & { details: CommentDetails } {
  return event.event_type === 'comment';
}

/**
 * Create event payload for API calls
 */
export type CreateEventPayload= {
  match_id: string;
  set_id?: string | null;
  team_id?: string | null;
  event_type: EventType;
  timestamp?: string; // Defaults to now if not provided
  team?: EventTeam;
  player_id?: string | null;
  details: EventDetails;
  home_score?: number | null;
  away_score?: number | null;
  point_number?: number | null;
}

/**
 * Filter options for querying events
 */
export type EventFilters= {
  match_id?: string;
  set_id?: string;
  event_type?: EventType | EventType[];
  team?: EventTeam;
  player_id?: string;
  from_timestamp?: string;
  to_timestamp?: string;
}

/**
 * Event icon mapping for UI display
 */
export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  substitution: 'users',
  timeout: 'clock',
  injury: 'heart-pulse',
  sanction: 'triangle-alert',
  technical: 'wrench',
  comment: 'message-square',
};

/**
 * Event color mapping for UI display
 */
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  substitution: 'blue',
  timeout: 'orange',
  injury: 'red',
  sanction: 'yellow',
  technical: 'purple',
  comment: 'gray',
};

/**
 * Human-readable event type labels
 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  substitution: 'Substitution',
  timeout: 'Timeout',
  injury: 'Injury',
  sanction: 'Sanction/Card',
  technical: 'Technical Issue',
  comment: 'Comment/Note',
};
