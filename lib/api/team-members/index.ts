import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";
import { TeamMember } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

export const createTeamMembersApi = (supabaseClient?: SupabaseClient) => {
  const dataStore = new SupabaseDataStore("team_members", supabaseClient);

  return {
    getTeamMembers: (filters?: Filter[], sort?: Sort<TeamMember>[],joins?: string[]) => dataStore.getAll(filters, sort, joins),
    createTeamMember: (team: Partial<TeamMember>) => {
      return dataStore.create(team);
    },
    updateTeamMember: (teamId: string, updates: Partial<TeamMember>) => {
      return dataStore.update(teamId, updates);
    },
    getTeamMember: (teamId: string) => {
      return dataStore.get(teamId);
    },
    deleteTeamMember: (teamId: string) => {
      return dataStore.delete(teamId);
    },
  };
};