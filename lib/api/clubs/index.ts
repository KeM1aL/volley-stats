import { Club } from "@/lib/types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { SupabaseClient } from "@supabase/supabase-js";

export const createClubApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("clubs", supabaseClient);

  return {
    getClubs: (filters?: Filter[], sort?: Sort<Club>[], joins?: string[]) =>
      dataStore.getAll(filters, sort, joins),
    getClubById: (id: string) => dataStore.get(id),
    createClub: (club: Partial<Club>) => dataStore.create(club),
  };
};
