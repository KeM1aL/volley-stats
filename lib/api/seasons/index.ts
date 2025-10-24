import { Season } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";

export const createSeasonApi = () => {
  const dataStore = new SupabaseDataStore("seasons") as SupabaseDataStore<"seasons", Season>;

  return {
    getSeasons: (filters?: Filter[], sort?: Sort<Season>[],joins?: string[]) =>
      dataStore.getAll(filters, sort, joins),
  };
};
