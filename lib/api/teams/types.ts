import { Database } from "@/lib/supabase/database.types";
import { Championship } from "@/lib/types";

export type Team = Database["public"]["Tables"]["teams"]["Row"] & {
  championship?: Championship;
};
