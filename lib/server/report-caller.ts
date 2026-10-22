import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export interface ReportCaller {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * The signed-in caller, with a client that reads with their own rights: the anon key plus their
 * token, never the service role, so RLS applies. Bearer token (Capacitor app) or cookie session (web).
 */
export async function getReportCaller(request: Request): Promise<ReportCaller | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (token) {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : { supabase, userId: data.user.id };
  }
  const cookieStore = await cookies();
  // The proxy refreshes the session cookie on this request, so nothing needs to be written back here.
  const supabase = createServerClient(url, anonKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } });
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : { supabase: supabase as unknown as SupabaseClient, userId: data.user.id };
}
