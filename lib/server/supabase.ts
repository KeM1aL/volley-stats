import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/types'

// Configuration error messages
const CONFIG_ERROR_MESSAGES = {
  missingSupabaseVariablesServer: 'Missing Supabase environment variables for server',
} as const;

export async function createClient() {
  // Read on use: importing this module must not need the service-role key.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error(CONFIG_ERROR_MESSAGES.missingSupabaseVariablesServer)
  }
  const cookieStore = await cookies()

  return createServerClient<Database>(
    supabaseUrl,
    serviceKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
