"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { z } from "zod";

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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem("userSettings");
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          const validated = settingsSchema.parse(parsed);
          setSettings(validated);
          setTheme(validated.theme);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        // Fallback to defaults if there's an error
        setSettings(defaultSettings);
        setTheme(defaultSettings.theme);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [setTheme]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };

      // Validate settings before saving
      const validated = settingsSchema.parse(updatedSettings);

      // Update theme if it changed
      if (newSettings.theme && newSettings.theme !== settings.theme) {
        setTheme(newSettings.theme);
      }

      // Save to localStorage
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