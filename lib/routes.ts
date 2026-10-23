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
  privacy: () => "/privacy",
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

/** Pages a signed-out visitor may open: the landing page, sign-in and email links, shared match stats, the privacy policy. */
export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/" || path === "/auth" || path.startsWith("/auth/") || path === "/matches/stats" || path === "/privacy";
}

/**
 * Every page of the app (the static export has one HTML file for each). Links opened with the app only go to these; the export
 * check keeps its own copy in scripts/lib/export-check.mjs (a script cannot import this file), and a unit test keeps both equal.
 */
export const APP_PAGES = [
  "/", "/auth", "/auth/confirm", "/auth/confirm-email", "/auth/reset-password", "/matches", "/matches/live", "/matches/score",
  "/matches/stats", "/teams", "/teams/new", "/teams/view", "/teams/players", "/championships",
  "/championships/view", "/settings", "/privacy",
] as const;

const APP_PAGE_SET: ReadonlySet<string> = new Set(APP_PAGES);

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

/** An in-app path (query included) that the root page may open: `/auth…` is allowed, `/api/` and `/_next/` are not. */
function isBootTarget(target: string | null | undefined): target is string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("://")) return false;
  // Browsers read "/\evil.com" and "/<tab>/evil.com" as "//evil.com": no backslashes or control characters.
  if (/[\\\u0000-\u001f\u007f]/.test(target)) return false;
  try {
    if (new URL(target, "http://x").origin !== "http://x") return false;
  } catch {
    return false;
  }
  const path = normalizePath(target.split(/[?#]/)[0]);
  return !(path.startsWith("/api/") || path.startsWith("/_next/"));
}

/**
 * The app serves its root HTML for every path without an extension, so a full page load of a sub-path shows the landing
 * page. Hard navigations therefore go to `/?to=<path>`; this reads that target (null when absent or unsafe).
 */
export function bootRedirectTarget(search: string): string | null {
  const target = new URLSearchParams(search).get("to");
  return isBootTarget(target) ? target : null;
}

/** After a reload of a sub-path the root page is rendered under that URL: the path to open again, null on the root page. */
export function reloadRedirectTarget(pathname: string, search: string): string | null {
  if (normalizePath(pathname) === "/") return null;
  const target = pathname + search;
  return isBootTarget(target) ? target : null;
}

/** The last target the root page forwarded to, kept for a short time to stop a path the router cannot open from looping. */
export interface BootForward {
  target: string;
  at: number;
}

export const BOOT_FORWARD_WINDOW_MS = 5000;

const sameTarget = (a: string, b: string): boolean => {
  const split = (value: string): [string, string] => {
    const index = value.search(/[?#]/);
    return index === -1 ? [value, ""] : [value.slice(0, index), value.slice(index)];
  };
  const [pathA, restA] = split(a);
  const [pathB, restB] = split(b);
  return normalizePath(pathA) === normalizePath(pathB) && restA === restB;
};

export type BootRedirectDecision = { action: "none" } | { action: "forward"; target: string } | { action: "abort" };

/**
 * What the root page does on load: `?to=` is read on the root path only; on any other path (a reload) that path is opened
 * again. A target already forwarded to within the last few seconds is not forwarded twice: the router could not open it
 * (unknown path) and fell back to a page load that brought us here again, so the caller stays on the landing page.
 */
export function bootRedirectDecision(
  pathname: string,
  search: string,
  previous: BootForward | null,
  now: number,
): BootRedirectDecision {
  const onRoot = normalizePath(pathname) === "/";
  const target = onRoot ? bootRedirectTarget(search) : reloadRedirectTarget(pathname, search);
  if (!target) return { action: "none" };
  if (previous && now - previous.at >= 0 && now - previous.at < BOOT_FORWARD_WINDOW_MS && sameTarget(previous.target, target)) {
    return { action: "abort" };
  }
  return { action: "forward", target };
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

const LEGACY_ROUTE_MATCHERS = LEGACY_ROUTE_REDIRECTS.map(({ source, destination }) => ({
  pattern: new RegExp(`^${source.replace(/:id\(([^)]*)\)/, "($1)")}/?$`, "i"),
  destination,
}));

/**
 * The in-app route for a link opened with the app (https://<web origin>/…): old path forms become the new route (query
 * kept), a path of a known page is kept as is. A link to another origin, one that does not parse, or one to an unknown path
 * opens the home page.
 */
export function appRouteFromUrl(url: string, webOrigin: string): string {
  let link: URL;
  let origin: string;
  try {
    link = new URL(url);
    origin = new URL(webOrigin).origin;
  } catch {
    return "/";
  }
  if (link.origin !== origin) return "/";
  // "//host/x" and "/\host" read as another origin to the router: no backslash or control character (also
  // percent-encoded), and leading slashes collapse to one.
  let decoded: string;
  try {
    decoded = decodeURIComponent(link.pathname);
  } catch {
    return "/";
  }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return "/";
  const path = link.pathname.replace(/^\/{2,}/, "/");
  const query = link.search.replace(/^\?/, "");
  for (const { pattern, destination } of LEGACY_ROUTE_MATCHERS) {
    const match = pattern.exec(path);
    if (match) {
      const route = destination.replace(":id", match[1].toLowerCase());
      return query ? `${route}&${query}` : route;
    }
  }
  const page = normalizePath(path);
  return APP_PAGE_SET.has(page) ? page + link.search : "/";
}
