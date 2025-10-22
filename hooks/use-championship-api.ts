import { getApi } from "@/lib/api";

export const useChampionshipApi = () => {
  return getApi().championships;
};
