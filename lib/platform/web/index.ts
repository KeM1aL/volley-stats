import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { saveBlob } from "@/lib/report/download";
import { createWebPlatform } from "../shared/sync";
import { supabaseConfig } from "../supabase-config";
import type { Platform } from "../types";
import { webNative } from "./native";
import { WebServiceWorker } from "./service-worker";

export const platform: Platform = {
  ...webNative,
  target: "web",
  apiOrigin: "",
  webOrigin: () => (typeof window === "undefined" ? process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "" : window.location.origin),
  createSupabaseClient: () => {
    const { url, anonKey } = supabaseConfig();
    // Cookie session: the proxy refreshes it and the report route can read it.
    return createBrowserClient<Database>(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  },
  ServiceWorker: WebServiceWorker,
  saveFile: async (data, fileName) => saveBlob(data, fileName),
  createSyncPlatform: createWebPlatform,
  hardNavigate: (path) => window.location.assign(path),
};
