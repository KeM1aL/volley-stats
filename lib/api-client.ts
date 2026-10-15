import { apiUrl } from "@/lib/api-url";
import { platform } from "@/lib/platform";
import { supabase } from "@/lib/supabase/client";

/** Calls the web deployment's API with the caller's Supabase access token (same check on web and mobile). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(apiUrl(path, platform.apiOrigin), { ...init, headers });
}
