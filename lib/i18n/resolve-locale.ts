import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./config";

export const LOCALE_STORAGE_KEY = "volleystats:locale";
/** Id of the user whose profile language this device already adopted. */
export const LOCALE_ADOPTED_KEY = "volleystats:locale-user";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function browserLocale(languages: readonly string[]): Locale | null {
  for (const language of languages) {
    const short = language.slice(0, 2).toLowerCase();
    if (isLocale(short)) return short;
  }
  return null;
}

/** First match wins: ?lang= (from the /fr/... redirect), the device's saved choice, the browser, English. */
export function initialLocale(input: { queryLang: string | null; stored: string | null; browser: readonly string[] }): Locale {
  if (isLocale(input.queryLang)) return input.queryLang;
  if (isLocale(input.stored)) return input.stored;
  return browserLocale(input.browser) ?? DEFAULT_LOCALE;
}

/**
 * The profile's language is adopted once per signed-in user on this device (their first load here), never
 * over an explicit choice (?lang=). After that the device's choice wins; changing it writes both.
 */
export function profileLocaleToAdopt(input: {
  userId: string | null;
  adoptedFor: string | null;
  explicit: boolean;
  profileLanguage: string | null | undefined;
  current: Locale;
}): Locale | null {
  if (!input.userId || input.adoptedFor === input.userId || input.explicit) return null;
  return isLocale(input.profileLanguage) && input.profileLanguage !== input.current ? input.profileLanguage : null;
}
