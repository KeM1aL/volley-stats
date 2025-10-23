import { createTeamApi } from "./teams";
import { createChampionshipApi } from "./championships";
import { createClubApi } from "./clubs";
import { createMatchApi } from "./matches";

const api = {
  teams: createTeamApi(),
  championships: createChampionshipApi(),
  clubs: createClubApi(),
  matches: createMatchApi()
  // ... other apis
};

export const getApi = () => api;
