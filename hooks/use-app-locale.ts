"use client";

import { useCallback } from "react";
import { useLocaleContext } from "@/components/providers/locale-provider";
import { useAuth } from "@/contexts/auth-context";
import { updateProfile } from "@/lib/api/users";
import type { Locale } from "@/lib/i18n/config";

/** The UI language: changes it on this device at once and saves it to the profile when signed in. */
export function useAppLocale() {
  const { locale, changeLocale } = useLocaleContext();
  const { user, setUser } = useAuth();
  const setLocale = useCallback(
    async (next: Locale) => {
      await changeLocale(next);
      if (user?.profile) {
        await updateProfile(user.id, { language: next });
        setUser({ ...user, profile: { ...user.profile, language: next } });
      }
    },
    [changeLocale, user, setUser]
  );
  return { locale, setLocale };
}
