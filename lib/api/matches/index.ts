import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { Match } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const createMatchApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("matches", supabaseClient);

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
    deleteMatch: (matchId: string) => {
      return dataStore.delete(matchId);
    },
  };
};