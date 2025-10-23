import { getApi } from "@/lib/api";

export const useMatchApi = () => {
  return getApi().matches;
};
