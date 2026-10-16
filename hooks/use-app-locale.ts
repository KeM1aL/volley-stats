"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useLocaleContext } from "@/components/providers/locale-provider";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "@/hooks/use-toast";
import { updateProfile } from "@/lib/api/users";
import type { Locale } from "@/lib/i18n/config";

/**
 * The UI language: changes it on this device at once and saves it to the profile when signed in.
 * Never throws: offline, the device keeps the new language and the profile keeps the old one.
 */
export function useAppLocale() {
  const t = useTranslations("common");
  const { locale, changeLocale } = useLocaleContext();
  const { user, setUser } = useAuth();
  const setLocale = useCallback(
    async (next: Locale) => {
      const changed = await changeLocale(next);
      if (!changed) {
        toast({ variant: "destructive", title: t("toast.languageChangeError") });
        return;
      }
      if (user?.profile) {
        try {
          await updateProfile(user.id, { language: next });
          setUser({ ...user, profile: { ...user.profile, language: next } });
        } catch (error) {
          console.error("Could not save the language to the profile:", error);
          toast({ variant: "destructive", title: t("toast.languageNotSaved") });
        }
      }
    },
    [changeLocale, user, setUser, t]
  );
  return { locale, setLocale };
}
