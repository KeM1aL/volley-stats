import { getApi } from "@/lib/api";

export const useEventApi = () => {
  return getApi().events;
};
