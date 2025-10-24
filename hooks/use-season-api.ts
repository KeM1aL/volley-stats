import { getApi } from "@/lib/api";

export const useSeasonApi = () => {
  return getApi().seasons;
};
