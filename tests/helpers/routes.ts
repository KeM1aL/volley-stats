/** The id of a query-param route URL (/matches/live?id=… or /matches/live/?id=… in the export). */
export function routeId(url: string): string {
  const id = new URL(url).searchParams.get('id');
  if (!id) throw new Error(`No ?id= in ${url}`);
  return id;
}
export const onPath = (path: string) => (url: URL) => url.pathname.replace(/\/+$/, '') === path;
