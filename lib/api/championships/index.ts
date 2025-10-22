import { Championship } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";

export const createChampionshipApi = () => {
  const dataStore = new SupabaseDataStore("championships") as SupabaseDataStore<"championships", Championship>;

  return {
    getChampionships: (filters?: Filter[], sort?: Sort<Championship>[],joins?: string[]) =>
      dataStore.getAll(filters, sort, joins),
  };
};
