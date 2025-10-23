import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { Match } from "@/lib/types";

export const createMatchApi = () => {
  const dataStore = new SupabaseDataStore("matches") as SupabaseDataStore<"matches", Match>;

  return {
    getMatchs: (filters?: Filter[], sort?: Sort<Match>[],joins?: string[]) => dataStore.getAll(filters, sort, joins),
    createMatch: (match: Partial<Match>) => {
      return dataStore.create(match);
    },
    updateMatch: (matchId: string, updates: Partial<Match>) => {
      return dataStore.update(matchId, updates);
    },
    getMatch: (matchId: string) => {
      return dataStore.get(matchId);
    },
    deleteMatch: (matchId: string) => {
      return dataStore.delete(matchId);
    },
  };
};