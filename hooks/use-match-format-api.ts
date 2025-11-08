import { getApi } from "@/lib/api";

export const useMatchFormatApi = () => {
  return getApi().matchFormats;
};
