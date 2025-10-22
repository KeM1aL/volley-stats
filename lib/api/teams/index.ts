import { Team } from "./types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";

export const createTeamApi = () => {
  const dataStore = new SupabaseDataStore("teams");

  return {
    getTeams: (filters?: Filter[], sort?: Sort<Team>[],joins?: string[]) => dataStore.getAll(filters, sort, joins),
    createTeam: (team: Partial<Team>) => {
      return dataStore.create(team);
    },
    updateTeam: (teamId: string, updates: Partial<Team>) => {
      return dataStore.update(teamId, updates);
    },
    getTeam: (teamId: string) => {
      return dataStore.get(teamId);
    },
    deleteTeam: (teamId: string) => {
      return dataStore.delete(teamId);
    },
  };
};