import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { Capacitor } from "@capacitor/core";
import { Passthrough } from "../shared/passthrough";
import { createWebPlatform } from "../shared/sync";
import { supabaseConfig } from "../supabase-config";
import type { Platform } from "../types";
import { saveFileNative } from "./files";
import { mobileNative } from "./native";
import { createPreferencesStorage } from "./storage";
import { createNativeSyncPlatform } from "./sync";

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
const webOrigin = process.env.NEXT_PUBLIC_WEB_ORIGIN;
if (!apiOrigin || !webOrigin) throw new Error("The mobile build needs NEXT_PUBLIC_API_ORIGIN and NEXT_PUBLIC_WEB_ORIGIN");

// Inside the Capacitor shell the native plugins are used; the same export opened in a browser (export e2e suite) behaves like web.
export const platform: Platform = {
  ...mobileNative,
  target: "mobile",
  apiOrigin,
  webOrigin: () => webOrigin,
  createSupabaseClient: () => {
    const { url, anonKey } = supabaseConfig();
    return createClient<Database>(url, anonKey, {
      auth: {
        storage: Capacitor.isNativePlatform()
          ? createPreferencesStorage()
          : typeof window === "undefined"
            ? undefined
            : window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Email links are handled by /auth/confirm.
        detectSessionInUrl: false,
      },
    });
  },
  ServiceWorker: Passthrough,
  Analytics: () => null,
  saveFile: saveFileNative,
  createSyncPlatform: () => (Capacitor.isNativePlatform() ? createNativeSyncPlatform() : createWebPlatform()),
  // Capacitor answers every extension-less path with the root index.html: the root page forwards to the target.
  hardNavigate: (path) => window.location.assign(`/?to=${encodeURIComponent(path)}`),
};
