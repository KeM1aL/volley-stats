import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Explicitly refresh the session to ensure token is valid
  // This will validate AND refresh the token if needed
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  // Handle refresh errors (expired refresh token, invalid session, etc.)
  if (error) {
    console.error('Session refresh failed in middleware:', error.message);

    // Only redirect to auth if not already on auth/public pages
    if (
      !request.nextUrl.pathname.startsWith('/auth') &&
      !request.nextUrl.pathname.startsWith('/stats') &&
      !request.nextUrl.pathname.endsWith('/score') &&
      request.nextUrl.pathname !== '/'
    ) {
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Check if user is authenticated
  if (
    !session &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/stats') &&
    !request.nextUrl.pathname.endsWith('/score') &&
    request.nextUrl.pathname !== '/'
  ) {
    const redirectUrl = new URL('/auth', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}