/** The URL of a web-deployment API path: same origin on web (""), the API origin in the app. */
export function apiUrl(path: string, origin: string): string {
  if (!path.startsWith("/")) throw new Error(`API paths start with "/": ${path}`);
  return origin.replace(/\/$/, "") + path;
}
