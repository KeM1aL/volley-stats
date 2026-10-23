import { Preferences } from "@capacitor/preferences";

/** supabase-js `storage` backed by the native key-value store (UserDefaults / SharedPreferences), which survives app restarts. */
export function createPreferencesStorage() {
  return {
    async getItem(key: string): Promise<string | null> {
      return (await Preferences.get({ key })).value;
    },
    async setItem(key: string, value: string): Promise<void> {
      await Preferences.set({ key, value });
    },
    async removeItem(key: string): Promise<void> {
      await Preferences.remove({ key });
    },
  };
}
