import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type AppConfig = { min_version: string; latest_version: string; store_url: string | null };

/** The minimum and latest app version for a store platform. `null` on error or when there is no row. */
export async function getAppConfig(
  supabase: SupabaseClient<Database>,
  platform: "ios" | "android",
): Promise<AppConfig | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("min_version, latest_version, store_url")
    .eq("platform", platform)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
