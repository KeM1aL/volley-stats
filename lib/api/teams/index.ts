import { Team } from "./types";
import { Filter, Sort } from "../types";
import { SupabaseDataStore } from "../supabase";

export const createTeamApi = () => {
  const dataStore = new SupabaseDataStore("teams");

  return {
    getTeams: (filter?: Filter<Team>, sort?: Sort<Team>[]) => dataStore.getAll(filter, sort),
    createTeam: (team: Partial<Team>) => {
      return dataStore.create(team);
    },
    updateTeam: (teamId: string, updates: Partial<Team>) => {
      return dataStore.update(teamId, updates);
    },
    deleteTeam: (teamId: string) => {
      return dataStore.delete(teamId);
    },
  };
};