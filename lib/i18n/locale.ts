import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from './config';

export type { Locale } from './config';
export { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';

/**
 * Get user locale with priority:
 * 1. Cookie (set by middleware from URL prefix, or by user preference)
 * 2. Supabase profile.language (authenticated users — fallback on first visit on new device)
 * 3. Accept-Language header (browser/system locale for non-authenticated users)
 * 4. Default (en)
 */
export async function getUserLocale(): Promise<Locale> {
  // 1. Check cookie (immediate updates, or set by middleware from URL prefix)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // 2. Check Supabase profile (authenticated users — fallback when no cookie set yet)
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single();

      if (profile?.language && SUPPORTED_LOCALES.includes(profile.language as Locale)) {
        return profile.language as Locale;
      }
    }
  } catch (error) {
    console.error('Failed to get user locale:', error);
  }

  // 3. Accept-Language header (browser/system locale for non-authenticated users)
  try {
    const headerStore = await headers();
    const acceptLanguage = headerStore.get('accept-language') ?? '';
    const preferred = acceptLanguage
      .split(',')
      .map(p => p.split(';')[0].trim().slice(0, 2).toLowerCase())
      .find(lang => SUPPORTED_LOCALES.includes(lang as Locale));
    if (preferred) return preferred as Locale;
  } catch {
    // headers() may not be available in all contexts
  }

  // 4. Default fallback
  return DEFAULT_LOCALE;
}
