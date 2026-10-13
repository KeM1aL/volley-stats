import { createHash } from "node:crypto";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

/** Bump when the report's layout or metrics change, so earlier copies are not reused. */
export const REPORT_VERSION = 1;

export const isLocale = (value: string | null | undefined): value is Locale =>
  !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);

export function resolveLocale(requested: string | null, profileLanguage: string | null): Locale {
  if (isLocale(requested)) return requested;
  if (isLocale(profileLanguage)) return profileLanguage;
  return DEFAULT_LOCALE;
}

export function reportEtag(parts: { lastModified: string; locale: Locale; teamId: string; version: number }): string {
  const hash = createHash("sha1").update([parts.version, parts.lastModified, parts.locale, parts.teamId].join("|")).digest("hex");
  return `"${hash}"`;
}

export function reportFileName(home: string, away: string, date: string): string {
  return `${home}-vs-${away}-${date.slice(0, 10)}.pdf`;
}

/** Attachment header with an ASCII fallback name and the exact name in RFC 5987 form. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/-\./g, ".")
    .toLowerCase();
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
