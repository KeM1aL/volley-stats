import { createTeamApi } from "./teams";
import { createChampionshipApi } from "./championships";
import { createClubApi } from "./clubs";

const api = {
  teams: createTeamApi(),
  championships: createChampionshipApi(),
  clubs: createClubApi(),
  // ... other apis
};

export const getApi = () => api;
