/** Every in-app URL is built here. Ids travel as ?id= so the static export has one HTML file per page. */
export type QueryParams = Record<string, string | null | undefined>;

const withQuery = (path: string, params: QueryParams = {}): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const routes = {
  home: () => "/",
  signIn: (redirectTo?: string | null) => withQuery("/auth", { redirectTo }),
  matches: () => "/matches",
  matchLive: (id: string, params: QueryParams = {}) => withQuery("/matches/live", { id, ...params }),
  matchScore: (id: string, params: QueryParams = {}) => withQuery("/matches/score", { id, ...params }),
  matchStats: (id: string, params: QueryParams = {}) => withQuery("/matches/stats", { id, ...params }),
  teams: () => "/teams",
  team: (id: string) => withQuery("/teams/view", { id }),
  teamPlayers: (id: string) => withQuery("/teams/players", { id }),
  championship: (id: string) => withQuery("/championships/view", { id }),
};

/** The static export uses trailing slashes; compare paths without them. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Pages a signed-out visitor may open: the landing page, sign-in and email links, shared match stats. */
export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/" || path === "/auth" || path.startsWith("/auth/") || path === "/matches/stats";
}

/** Screens that load everything from Supabase: offline they would open empty (the live match works offline). */
const CONNECTED_PATHS = new Set([
  "/matches",
  "/teams",
  "/teams/new",
  "/teams/view",
  "/teams/players",
  "/championships",
  "/championships/view",
]);

/** Whether this screen needs a connection to show anything (OfflineGate shows the offline screen instead). */
export function requiresConnection(pathname: string): boolean {
  return CONNECTED_PATHS.has(normalizePath(pathname));
}

const TECHNICAL_FILE = /\.(webmanifest|json|xml|ico|png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|eot|txt)$/i;

/** A redirectTo value that stays in the app and leads to a page worth returning to. */
export function isSafeRedirectTarget(target: string | null | undefined): target is string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("://")) return false;
  // Browsers read "/\evil.com" and "/<tab>/evil.com" as "//evil.com": no backslashes or control characters.
  if (/[\\\u0000-\u001f\u007f]/.test(target)) return false;
  try {
    if (new URL(target, "http://x").origin !== "http://x") return false;
  } catch {
    return false;
  }
  const path = normalizePath(target.split(/[?#]/)[0]);
  if (path === "/auth" || path.startsWith("/auth/") || path.startsWith("/api/") || path.startsWith("/_next/")) return false;
  return !TECHNICAL_FILE.test(path);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRouteId(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value.toLowerCase() : null;
}

const ID = ":id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

/** Old dynamic URLs (web only). The UUID pattern keeps /teams/new and the new routes out. */
export const LEGACY_ROUTE_REDIRECTS = [
  { source: `/matches/${ID}/live`, destination: "/matches/live?id=:id" },
  { source: `/matches/${ID}/score`, destination: "/matches/score?id=:id" },
  { source: `/matches/${ID}/stats`, destination: "/matches/stats?id=:id" },
  { source: `/teams/${ID}/players`, destination: "/teams/players?id=:id" },
  { source: `/teams/${ID}`, destination: "/teams/view?id=:id" },
  { source: `/championships/${ID}`, destination: "/championships/view?id=:id" },
];
