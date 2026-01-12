import { getApi } from "@/lib/api";

export const useTeamMembersApi = () => {
  return getApi().teamMembers;
};
