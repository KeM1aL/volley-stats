import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { MatchFormat } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const createMatchFormatApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("match_formats", supabaseClient);

  return {
    getMatchFormats: (filters?: Filter[], sort?: Sort<MatchFormat>[], joins?: string[]) =>
      dataStore.getAll(filters, sort, joins),
    createMatchFormat: (matchFormat: Partial<MatchFormat>) => {
      return dataStore.create(matchFormat);
    },
    updateMatchFormat: (matchFormatId: string, updates: Partial<MatchFormat>) => {
      return dataStore.update(matchFormatId, updates);
    },
    getMatchFormat: (matchFormatId: string, joins?: string[]) => {
      return dataStore.get(matchFormatId, joins);
    },
    deleteMatchFormat: (matchFormatId: string) => {
      return dataStore.delete(matchFormatId);
    },
  };
};
