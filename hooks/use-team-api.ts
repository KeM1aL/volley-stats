import { createApi } from "@/lib/api";

export const useTeamApi = () => {
  return createApi().teams;
};