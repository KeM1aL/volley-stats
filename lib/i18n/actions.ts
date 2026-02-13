'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Locale, SUPPORTED_LOCALES } from './config';

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
