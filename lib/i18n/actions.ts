'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config';

export async function updateLocale(locale: Locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return { success: false };
  }

  // Update cookie for immediate effect
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  // Update Supabase profile
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('profiles')
      .update({ language: locale })
      .eq('id', user.id);
  }

  return { success: true };
}

/**
 * Sync locale cookie from the authenticated user's profile language.
 * Called after login to ensure the cookie matches the stored preference.
 */
export async function syncLocaleFromProfile(): Promise<Locale> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_LOCALE;

  const { data: profile } = await supabase
    .from('profiles')
    .select('language')
    .eq('id', user.id)
    .single();

  const locale = (
    profile?.language && SUPPORTED_LOCALES.includes(profile.language as Locale)
      ? profile.language
      : DEFAULT_LOCALE
  ) as Locale;

  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return locale;
}
