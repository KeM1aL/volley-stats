import { Club } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";

export const createClubApi = () => {
  const dataStore = new SupabaseDataStore("clubs") as SupabaseDataStore<"clubs", Club>;

  return {
    getClubs: (filters?: Filter[], sort?: Sort<Club>[], joins?: string[]) =>
      dataStore.getAll(filters, sort, joins),
    getClubById: (id: string) => dataStore.get(id),
  };
};
