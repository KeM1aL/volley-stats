import { createTeamApi } from "./teams";
import { createChampionshipApi } from "./championships";
import { createClubApi } from "./clubs";
import { createMatchApi } from "./matches";
import { createSeasonApi } from "./seasons";
import { createMatchFormatApi } from "./match-formats";
import { createEventApi } from "./events";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { createTeamMembersApi } from "./team-members";

export const createApi = (supabaseClient: SupabaseClient) => ({
  teams: createTeamApi(supabaseClient),
  teamMembers: createTeamMembersApi(supabaseClient),
  championships: createChampionshipApi(supabaseClient),
  clubs: createClubApi(supabaseClient),
  matches: createMatchApi(supabaseClient),
  seasons: createSeasonApi(supabaseClient),
  matchFormats: createMatchFormatApi(supabaseClient),
  events: createEventApi(supabaseClient)
});

const api = createApi(supabase);

export const getApi = () => api;
