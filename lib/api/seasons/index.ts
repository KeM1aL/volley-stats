import { Season } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { SupabaseClient } from "@supabase/supabase-js";

export const createSeasonApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("seasons", supabaseClient);

  return {
    getSeasons: (filters?: Filter[], sort?: Sort<Season>[]) =>
      dataStore.getAll(filters, sort),
  };
};