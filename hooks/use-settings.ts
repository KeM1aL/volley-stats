"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { getUser, updateProfile } from "@/lib/api/users";
import { supabase } from "@/lib/supabase/client";

export const settingsSchema = z.object({
  favoriteTeam: z.string().optional(),
  language: z.string().min(1, "Please select a language"),
  theme: z.enum(["light", "dark", "system"]),
  notifications: z.object({
    matchReminders: z.boolean(),
    scoreUpdates: z.boolean(),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

const defaultSettings: Settings = {
  language: "en",
  theme: "system",
  notifications: {
    matchReminders: true,
    scoreUpdates: true,
  },
};

export function useSettings() {
  const { theme, setTheme } = useTheme();
  const { user, setUser } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(() => {
    try {
      const savedSettings = localStorage.getItem("userSettings");
      let loadedSettings = defaultSettings;

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        const validated = settingsSchema.parse(parsed);
        loadedSettings = { ...loadedSettings, ...validated };
      }

      if (user?.profile?.language) {
        loadedSettings.language = user.profile.language;
      }

      setSettings(loadedSettings);
      setTheme(loadedSettings.theme);
    } catch (error) {
      console.error("Failed to load settings:", error);
      setSettings(defaultSettings);
      setTheme(defaultSettings.theme);
    } finally {
      setIsLoading(false);
    }
  }, [setTheme, user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };

      const validated = settingsSchema.parse(updatedSettings);

      if (newSettings.theme && newSettings.theme !== settings.theme) {
        setTheme(newSettings.theme);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && newSettings.language) {
        await updateProfile(session.user.id, {
          language: newSettings.language,
        });
        const updatedUser = await getUser();
        setUser(updatedUser);
      }

      localStorage.setItem("userSettings", JSON.stringify(validated));
      setSettings(validated);

      return { success: true as const };
    } catch (error) {
      console.error("Failed to update settings:", error);
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to update settings",
      };
    }
  };

  const resetSettings = () => {
    localStorage.removeItem("userSettings");
    setSettings(defaultSettings);
    setTheme(defaultSettings.theme);
    return defaultSettings;
  };

  return {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
  };
}
