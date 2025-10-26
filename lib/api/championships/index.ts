import { Championship } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { SupabaseClient } from "@supabase/supabase-js";

export const createChampionshipApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("championships", supabaseClient);

  return {
    getChampionships: (filters?: Filter[], sort?: Sort<Championship>[],joins?: string[]) =>
      dataStore.getAll(filters, sort, joins),
  };
};
