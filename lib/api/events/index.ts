import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { Event } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  EventType,
  EventTeam,
  CreateEventPayload,
  EventFilters,
  SubstitutionDetails,
  TimeoutDetails,
  InjuryDetails,
  SanctionDetails,
  TechnicalDetails,
  CommentDetails,
} from "@/lib/types/events";

/**
 * Event API for managing match events
 * Provides CRUD operations and helper methods for different event types
 */
export const createEventApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("events", supabaseClient);

  return {
    /**
     * Get all events with optional filters, sorting, and joins
     */
    getAll: async (filters?: Filter[], sort?: any[], joins?: string[]): Promise<Event[]> => {
      const results = await dataStore.getAll(filters, sort, joins);
      return results as Event[];
    },

    /**
     * Get events for a specific match
     */
    getMatchEvents: async (matchId: string, eventType?: EventType | EventType[]): Promise<Event[]> => {
      const filters: Filter[] = [{ field: "match_id", operator: "eq", value: matchId }];

      if (eventType) {
        if (Array.isArray(eventType)) {
          filters.push({ field: "event_type", operator: "in", value: eventType });
        } else {
          filters.push({ field: "event_type", operator: "eq", value: eventType });
        }
      }

      const results = await dataStore.getAll(
        filters,
        [{ field: "timestamp", direction: "asc" }]
      );
      return results as Event[];
    },

    /**
     * Get events for a specific set
     */
    getSetEvents: async (setId: string, eventType?: EventType | EventType[]): Promise<Event[]> => {
      const filters: Filter[] = [{ field: "set_id", operator: "eq", value: setId }];

      if (eventType) {
        if (Array.isArray(eventType)) {
          filters.push({ field: "event_type", operator: "in", value: eventType });
        } else {
          filters.push({ field: "event_type", operator: "eq", value: eventType });
        }
      }

      const results = await dataStore.getAll(
        filters,
        [{ field: "timestamp", direction: "asc" }]
      );
      return results as Event[];
    },

    /**
     * Get events with advanced filtering
     */
    getFilteredEvents: async (filters: EventFilters): Promise<Event[]> => {
      const apiFilters: Filter[] = [];

      if (filters.match_id) {
        apiFilters.push({ field: "match_id", operator: "eq", value: filters.match_id });
      }
      if (filters.set_id) {
        apiFilters.push({ field: "set_id", operator: "eq", value: filters.set_id });
      }
      if (filters.event_type) {
        if (Array.isArray(filters.event_type)) {
          apiFilters.push({ field: "event_type", operator: "in", value: filters.event_type });
        } else {
          apiFilters.push({ field: "event_type", operator: "eq", value: filters.event_type });
        }
      }
      if (filters.team) {
        apiFilters.push({ field: "team", operator: "eq", value: filters.team });
      }
      if (filters.player_id) {
        apiFilters.push({ field: "player_id", operator: "eq", value: filters.player_id });
      }
      if (filters.from_timestamp) {
        apiFilters.push({ field: "timestamp", operator: "gte", value: filters.from_timestamp });
      }
      if (filters.to_timestamp) {
        apiFilters.push({ field: "timestamp", operator: "lte", value: filters.to_timestamp });
      }

      const results = await dataStore.getAll(
        apiFilters,
        [{ field: "timestamp", direction: "asc" }]
      );
      return results as Event[];
    },

    /**
     * Create a new event
     */
    createEvent: async (payload: CreateEventPayload): Promise<Event> => {
      const event: Partial<Event> = {
        match_id: payload.match_id,
        set_id: payload.set_id || null,
        team_id: payload.team_id || null,
        event_type: payload.event_type,
        timestamp: payload.timestamp || new Date().toISOString(),
        team: payload.team || null,
        player_id: payload.player_id || null,
        details: payload.details as any,
      };
      const result = await dataStore.create(event);
      return result as Event;
    },

    /**
     * Create a substitution event
     */
    createSubstitution: async (
      matchId: string,
      setId: string,
      teamId: string,
      team: EventTeam,
      details: SubstitutionDetails
    ): Promise<Event> => {
      const result = await dataStore.create({
        match_id: matchId,
        set_id: setId,
        team_id: teamId,
        event_type: "substitution",
        timestamp: new Date().toISOString(),
        team,
        player_id: details.player_in_id, // Primary player is the one entering
        details: details as any,
      });
      return result as Event;
    },

    /**
     * Create a timeout event
     */
    createTimeout: async (
      matchId: string,
      setId: string,
      teamId: string,
      team: EventTeam,
      details: TimeoutDetails
    ): Promise<Event> => {
      const result = await dataStore.create({
        match_id: matchId,
        set_id: setId,
        team_id: teamId,
        event_type: "timeout",
        timestamp: new Date().toISOString(),
        team,
        player_id: null,
        details: details as any,
      });
      return result as Event;
    },

    /**
     * Create an injury event
     */
    createInjury: async (
      matchId: string,
      setId: string,
      teamId: string,
      team: EventTeam,
      playerId: string,
      details: InjuryDetails
    ): Promise<Event> => {
      const result = await dataStore.create({
        match_id: matchId,
        set_id: setId,
        team_id: teamId,
        event_type: "injury",
        timestamp: new Date().toISOString(),
        team,
        player_id: playerId,
        details: details as any,
      });
      return result as Event;
    },

    /**
     * Create a sanction event
     */
    createSanction: async (
      matchId: string,
      setId: string,
      teamId: string,
      team: EventTeam,
      playerId: string | null,
      details: SanctionDetails
    ): Promise<Event> => {
      const result = await dataStore.create({
        match_id: matchId,
        set_id: setId,
        team_id: teamId,
        event_type: "sanction",
        timestamp: new Date().toISOString(),
        team,
        player_id: playerId,
        details: details as any,
      });
      return result as Event;
    },

    /**
     * Create a technical issue event
     */
    createTechnical: async (
      matchId: string,
      setId: string | null,
      details: TechnicalDetails
    ): Promise<Event> => {
      const result = await dataStore.create({
        match_id: matchId,
        set_id: setId,
        team_id: null,
        event_type: "technical",
        timestamp: new Date().toISOString(),
        team: details.affected_team || null,
        player_id: null,
        details: details as any,
      });
      return result as Event;
    },

    /**
     * Create a comment event
     */
    createComment: async (
      matchId: string,
      setId: string | null,
      details: CommentDetails
    ): Promise<Event> => {
      const result = await dataStore.create({
        match_id: matchId,
        set_id: setId,
        team_id: null,
        event_type: "comment",
        timestamp: new Date().toISOString(),
        team: null,
        player_id: null,
        details: details as any,
      });
      return result as Event;
    },

    /**
     * Get a single event by ID
     */
    getEvent: async (eventId: string): Promise<Event | null> => {
      const result = await dataStore.get(eventId);
      return result as Event | null;
    },

    /**
     * Update an event
     */
    updateEvent: async (eventId: string, updates: Partial<Event>): Promise<Event> => {
      const result = await dataStore.update(eventId, updates);
      return result as Event;
    },

    /**
     * Delete an event
     */
    deleteEvent: async (eventId: string): Promise<void> => {
      return dataStore.delete(eventId);
    },

    /**
     * Get substitution events with full details
     * This is useful for compatibility with old substitutions table queries
     */
    getSubstitutions: async (matchId: string, setId?: string) => {
      const filters: Filter[] = [
        { field: "match_id", operator: "eq", value: matchId },
        { field: "event_type", operator: "eq", value: "substitution" },
      ];

      if (setId) {
        filters.push({ field: "set_id", operator: "eq", value: setId });
      }

      const results = await dataStore.getAll(
        filters,
        [{ field: "timestamp", direction: "asc" }]
      );
      const events = results as Event[];

      // Transform to a more convenient format for substitutions
      return events.map((event) => ({
        ...event,
        player_in_id: (event.details as SubstitutionDetails).player_in_id,
        player_out_id: (event.details as SubstitutionDetails).player_out_id,
        position: (event.details as SubstitutionDetails).position,
        comments: (event.details as SubstitutionDetails).comments,
      }));
    },
  };
};
