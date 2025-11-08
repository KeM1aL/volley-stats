import { createTeamApi } from "./teams";
import { createChampionshipApi } from "./championships";
import { createClubApi } from "./clubs";
import { createMatchApi } from "./matches";
import { createSeasonApi } from "./seasons";
import { createMatchFormatApi } from "./match-formats";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

export const createApi = (supabaseClient: SupabaseClient) => ({
  teams: createTeamApi(supabaseClient),
  championships: createChampionshipApi(supabaseClient),
  clubs: createClubApi(supabaseClient),
  matches: createMatchApi(supabaseClient),
  seasons: createSeasonApi(supabaseClient),
  matchFormats: createMatchFormatApi(supabaseClient)
  // ... other apis
});

const api = createApi(supabase);

export const getApi = () => api;
