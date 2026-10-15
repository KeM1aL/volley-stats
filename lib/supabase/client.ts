import { platform } from "@/lib/platform";

export function createClient() {
  return platform.createSupabaseClient();
}

export const supabase = createClient();
