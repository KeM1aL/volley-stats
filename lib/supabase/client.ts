import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Configuration error messages
const CONFIG_ERROR_MESSAGES = {
  missingSupabaseVariables: 'Missing Supabase environment variables',
} as const;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(CONFIG_ERROR_MESSAGES.missingSupabaseVariables);
}

export function createJsClient() {
  return createBrowserClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      }
    }
  );
}

export function createClient() {
  return createBrowserClient<Database>(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
      }
    }
  );
}

export const supabase = createClient();