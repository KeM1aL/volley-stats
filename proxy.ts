import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/server/session';
import { splitLocalePrefix } from '@/lib/i18n/locale-path';

export async function proxy(req: NextRequest) {
  // /fr/matches → /matches?lang=fr: the client picks up the language and saves it on the device.
  const prefixed = splitLocalePrefix(req.nextUrl.pathname);
  if (prefixed) {
    const url = req.nextUrl.clone();
    url.pathname = prefixed.path;
    url.searchParams.set('lang', prefixed.locale);
    return NextResponse.redirect(url, 307);
  }
  return updateSession(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|serwist|offline\\.html|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
