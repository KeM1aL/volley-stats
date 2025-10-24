import { createTeamApi } from "./teams";
import { createChampionshipApi } from "./championships";
import { createClubApi } from "./clubs";
import { createMatchApi } from "./matches";
import { createSeasonApi } from "./seasons";

const api = {
  teams: createTeamApi(),
  championships: createChampionshipApi(),
  clubs: createClubApi(),
  matches: createMatchApi(),
  seasons: createSeasonApi()
  // ... other apis
};

export const getApi = () => api;
