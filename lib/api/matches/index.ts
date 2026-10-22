import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { Match } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultClient } from "@/lib/supabase/client";

export const createMatchApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("matches", supabaseClient);
  const client = supabaseClient ?? defaultClient;

  return {
    getMatchs: (filters?: Filter[], sort?: Sort<Match>[],joins?: string[]) => dataStore.getAll(filters, sort, joins),
    createMatch: (match: Partial<Match>) => {
      return dataStore.create(match);
    },
    updateMatch: (matchId: string, updates: Partial<Match>) => {
      return dataStore.update(matchId, updates);
    },
    getMatch: (matchId: string, joins?: string[]) => {
      return dataStore.get(matchId, joins);
    },
    archiveMatch: (matchId: string): Promise<Match> => {
      return dataStore.update(matchId, { archived_at: new Date().toISOString() }) as Promise<Match>;
    },
    restoreMatch: (matchId: string): Promise<Match> => {
      return dataStore.update(matchId, { archived_at: null }) as Promise<Match>;
    },
    /** Hard-deletes a match that has not started; throws the PostgREST error (see removalError). */
    deleteUnstartedMatch: async (matchId: string): Promise<void> => {
      const { error } = await client.rpc("delete_unstarted_match", { match_id: matchId });
      if (error) throw error;
    },
    isMatchArchived: async (matchId: string): Promise<boolean> => {
      const { data, error } = await client.from("matches").select("archived_at").eq("id", matchId).maybeSingle();
      if (error) throw error;
      return !!data?.archived_at;
    },
  };
};