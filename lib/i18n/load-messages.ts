import type { Locale } from "@/lib/i18n/config";

export interface LoadedMessages<M> {
  /** The locale whose messages were loaded: `requested`, or the first fallback that loaded. */
  locale: Locale;
  messages: M;
}

/**
 * Loads the messages of `requested`; when that import fails (offline, a chunk that is gone after a
 * deploy), tries each of `fallbacks` in order. Returns null when none loads, so the caller can keep
 * what is on screen instead of failing.
 */
export async function loadMessagesWithFallback<M>(
  loaders: Record<Locale, () => Promise<{ default: M }>>,
  requested: Locale,
  fallbacks: readonly Locale[]
): Promise<LoadedMessages<M> | null> {
  for (const locale of [requested, ...fallbacks.filter((fallback) => fallback !== requested)]) {
    try {
      return { locale, messages: (await loaders[locale]()).default };
    } catch (error) {
      console.warn(`Could not load the ${locale} messages:`, error);
    }
  }
  return null;
}
