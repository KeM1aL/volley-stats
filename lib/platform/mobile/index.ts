import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { saveBlob } from "@/lib/report/download";
import { Passthrough } from "../shared/passthrough";
import { createWebPlatform } from "../shared/sync";
import { supabaseConfig } from "../supabase-config";
import type { Platform } from "../types";

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
const webOrigin = process.env.NEXT_PUBLIC_WEB_ORIGIN;
if (!apiOrigin || !webOrigin) throw new Error("The mobile build needs NEXT_PUBLIC_API_ORIGIN and NEXT_PUBLIC_WEB_ORIGIN");

// Browser stand-ins for now: sub-project 2 replaces saveFile, the sync signals and storage with Capacitor plugins.
export const platform: Platform = {
  target: "mobile",
  apiOrigin,
  webOrigin: () => webOrigin,
  createSupabaseClient: () => {
    const { url, anonKey } = supabaseConfig();
    return createClient<Database>(url, anonKey, {
      auth: {
        storage: typeof window === "undefined" ? undefined : window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Email links are handled by /auth/confirm.
        detectSessionInUrl: false,
      },
    });
  },
  ServiceWorker: Passthrough,
  saveFile: async (data, fileName) => saveBlob(data, fileName),
  createSyncPlatform: createWebPlatform,
  // Capacitor answers every extension-less path with the root index.html: the root page forwards to the target.
  hardNavigate: (path) => window.location.assign(`/?to=${encodeURIComponent(path)}`),
};
