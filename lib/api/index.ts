import { createTeamApi } from "./teams";

export const createApi = () => {
  return {
    teams: createTeamApi(),
    // ... other apis
  };
};