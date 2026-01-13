import { Championship } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { SupabaseClient } from "@supabase/supabase-js";

export const createChampionshipApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("championships", supabaseClient);

  return {
    getChampionships: (filters?: Filter[], sort?: Sort<Championship>[], joins?: string[]) => {
      // Auto-join match_formats to access format field
      const defaultJoins = ['match_formats'];
      const mergedJoins = joins ? [...new Set([...defaultJoins, ...joins])] : defaultJoins;
      return dataStore.getAll(filters, sort, mergedJoins);
    },
    createChampionship: (championship: Partial<Championship>) => {
      return dataStore.create(championship);
    },
    updateChampionship: (championshipId: string, updates: Partial<Championship>) => {
      return dataStore.update(championshipId, updates);
    },
    getChampionship: (championshipId: string) => {
      return dataStore.get(championshipId);
    },
  };
};
