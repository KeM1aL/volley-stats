/**
 * Link of an auth email: the app's /auth/confirm page verifies the token_hash (works in any browser, and
 * in the mobile app through universal links). Plain TypeScript, no Deno APIs: unit-tested from the app.
 */
export function buildConfirmUrl(input: { siteUrl: string; redirectTo: string; tokenHash: string; type: string }): string {
  let origin = new URL(input.siteUrl).origin;
  let next: string | null = null;
  try {
    const redirect = new URL(input.redirectTo);
    origin = redirect.origin;
    const path = redirect.pathname.replace(/\/+$/, "") || "/";
    // Sign-in pages (/auth, /auth/callback, the old /fr/auth) are not pages to come back to.
    const isAuthPage = /^\/([a-z]{2}\/)?auth(\/|$)/.test(path);
    if (!isAuthPage && path !== "/") next = path + redirect.search;
  } catch {
    // No usable redirect: the site URL, and home after confirming.
  }
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", input.type);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
