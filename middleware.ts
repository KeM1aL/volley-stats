import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if pathname starts with a locale
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    // Extract locale from path (e.g., /fr/matches → fr)
    const locale = pathname.split('/')[1] as Locale;

    // Rewrite to remove locale from URL (internally route to non-prefixed path)
    const newPathname = pathname.replace(`/${locale}`, '') || '/';
    const newUrl = new URL(newPathname + req.nextUrl.search, req.url);

    // Update session for Supabase
    const supabaseResponse = await updateSession(req);

    // Persist locale from URL prefix for future visits
    const response = NextResponse.rewrite(newUrl);
    response.cookies.set('NEXT_LOCALE', locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    // Copy Supabase session cookies to the response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    return response;
  }

  // No locale in path - continue with Supabase session update
  return updateSession(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",],
};