"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/auth-context";
import type { Locale } from "@/lib/i18n/config";
import { loadMessagesWithFallback } from "@/lib/i18n/load-messages";
import { adoptionMarkToWrite, initialLocale, isLocale, LOCALE_ADOPTED_KEY, LOCALE_STORAGE_KEY, profileLocaleToAdopt } from "@/lib/i18n/resolve-locale";

const LOADERS = {
  en: () => import("@/messages/en"),
  fr: () => import("@/messages/fr"),
  es: () => import("@/messages/es"),
  it: () => import("@/messages/it"),
  pt: () => import("@/messages/pt"),
} satisfies Record<Locale, () => Promise<{ default: unknown }>>;

type Messages = Awaited<ReturnType<(typeof LOADERS)["en"]>>["default"];

interface LocaleContextValue {
  locale: Locale;
  /** Resolves to whether `locale` is now the language; false when its messages could not be loaded (the screen is kept). */
  changeLocale(locale: Locale, explicit?: boolean): Promise<boolean>;
  /** Whether the locale came from ?lang= on this page load. */
  explicit: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ locale: Locale; messages: Messages; explicit: boolean } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const hasMessages = useRef(false);

  // `explicit` (the locale came from ?lang= on this page load) is only set by the first call and kept after.
  // A messages chunk that does not load (offline, gone after a deploy) never throws: later switches keep the
  // current language, and the first load falls back to English.
  const changeLocale = useCallback(async (locale: Locale, explicit?: boolean) => {
    const loaded = await loadMessagesWithFallback(LOADERS, locale, hasMessages.current ? [] : ["en"]);
    if (!loaded) {
      if (!hasMessages.current) setLoadFailed(true);
      return false;
    }
    hasMessages.current = true;
    if (loaded.locale === locale) localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = loaded.locale;
    setState((previous) => ({ locale: loaded.locale, messages: loaded.messages, explicit: explicit ?? previous?.explicit ?? false }));
    return loaded.locale === locale;
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const queryLang = url.searchParams.get("lang");
    // The language is only known in the browser (?lang=, localStorage, navigator), so it is chosen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void changeLocale(
      initialLocale({ queryLang, stored: localStorage.getItem(LOCALE_STORAGE_KEY), browser: navigator.languages ?? [navigator.language] }),
      isLocale(queryLang)
    );
    if (queryLang !== null) {
      url.searchParams.delete("lang");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [changeLocale]);

  if (!state && loadFailed) {
    // No messages at all, so this text cannot be translated.
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p>The app could not be loaded. Check your connection and try again.</p>
        <button type="button" className="rounded-md border px-4 py-2" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  return (
    <LocaleContext.Provider value={{ locale: state.locale, changeLocale, explicit: state.explicit }}>
      <NextIntlClientProvider locale={state.locale} messages={state.messages} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocaleContext must be used within a LocaleProvider");
  return context;
}

/** Inside AuthProvider: adopts the signed-in user's profile language once on this device. */
export function ProfileLocaleSync(): null {
  const { user, session } = useAuth();
  const { locale, changeLocale, explicit } = useLocaleContext();
  const sessionUserId = session?.user.id ?? null;

  // An explicit ?lang= must outlive a reload that happens before the profile loads: the session user is known
  // right after sign-in, the profile is not.
  useEffect(() => {
    const mark = adoptionMarkToWrite({ sessionUserId, adoptedFor: localStorage.getItem(LOCALE_ADOPTED_KEY), explicit });
    if (mark) localStorage.setItem(LOCALE_ADOPTED_KEY, mark);
  }, [sessionUserId, explicit]);

  useEffect(() => {
    if (!user) return;
    const adopt = profileLocaleToAdopt({
      userId: user.id,
      adoptedFor: localStorage.getItem(LOCALE_ADOPTED_KEY),
      explicit,
      profileLanguage: user.profile?.language,
      current: locale,
    });
    localStorage.setItem(LOCALE_ADOPTED_KEY, user.id);
    if (adopt) void changeLocale(adopt);
  }, [user, locale, changeLocale, explicit]);
  return null;
}
