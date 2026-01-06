import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Helper function to check if a path should be saved for redirect
function shouldSaveRedirect(pathname: string): boolean {
  // Don't redirect to auth pages
  if (pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/login')) {
    return false;
  }

  // Don't redirect to technical/static files
  const technicalExtensions = [
    '.webmanifest',
    '.json',
    '.xml',
    '.ico',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.webp',
    '.css',
    '.js',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];

  if (technicalExtensions.some(ext => pathname.endsWith(ext))) {
    return false;
  }

  // Don't redirect to API routes
  if (pathname.startsWith('/api/')) {
    return false;
  }

  // Don't redirect to Next.js internal routes
  if (pathname.startsWith('/_next/')) {
    return false;
  }

  return true;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value))
        },
      },
    }
  )
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !(request.nextUrl.pathname === '/')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth'

    // Only save redirectTo for meaningful user pages
    if (shouldSaveRedirect(request.nextUrl.pathname)) {
      url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)
    }

    return NextResponse.redirect(url)
  }
  return supabaseResponse
}
