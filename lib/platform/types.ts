import type { ComponentType, ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";

export type BuildTarget = "web" | "mobile";

/** Everything that differs between the web deployment and the Capacitor app. Chosen at build time. */
export interface Platform {
  target: BuildTarget;
  /** Origin of the web deployment's API: "" on web (same origin), NEXT_PUBLIC_API_ORIGIN on mobile. */
  apiOrigin: string;
  /** Origin for links that leave the app (auth emails, shared stats links). */
  webOrigin(): string;
  createSupabaseClient(): SupabaseClient<Database>;
  ServiceWorker: ComponentType<{ children: ReactNode }>;
  saveFile(data: Blob, fileName: string): Promise<void>;
  createSyncPlatform(): SyncPlatform;
  /** Full page load of an in-app path (the app serves its root page for sub-paths, so mobile goes through `/?to=`). */
  hardNavigate(path: string): void;
}
