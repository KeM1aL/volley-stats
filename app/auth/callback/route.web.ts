import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      // Redirect to error page or login with error message
      return NextResponse.redirect(
        new URL(`/auth?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    // Check if this is a password recovery flow
    if (type === 'recovery') {
      // Redirect to reset password page where user can set new password
      return NextResponse.redirect(new URL('/auth/reset-password', request.url));
    }
  }

  // For email confirmation and other flows, redirect to next or home
  return NextResponse.redirect(new URL(next, request.url));
}
