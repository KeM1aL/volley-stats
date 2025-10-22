import { getApi } from "@/lib/api";

export const useClubApi = () => {
  return getApi().clubs;
};
