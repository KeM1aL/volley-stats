import type { Locale } from "./config";
import { isLocale } from "./resolve-locale";

/** "/fr/matches" → { locale: "fr", path: "/matches" }; null when the path has no locale prefix. */
export function splitLocalePrefix(pathname: string): { locale: Locale; path: string } | null {
  const match = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (!match || !isLocale(match[1])) return null;
  return { locale: match[1], path: match[2] || "/" };
}
