import { getApi } from "@/lib/api";

export const useTeamApi = () => {
  return getApi().teams;
};
