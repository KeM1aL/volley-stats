import type { ComponentType, ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";

export type BuildTarget = "web" | "mobile";

/** What `shareLink` did: handed the link to a share dialog, copied it to the clipboard, or the person closed the dialog. */
export type ShareLinkResult = "shared" | "copied" | "cancelled";

/** Device features the app uses; no-ops or browser equivalents on web. */
export interface NativeFeatures {
  /** "ios" or "android" inside the Capacitor app; null on web and in a browser. */
  nativePlatform: "ios" | "android" | null;
  /** Keeps the screen on; resolves to the function that lets it sleep again. */
  keepAwake(): Promise<() => Promise<void>>;
  haptics: { tap(): Promise<void>; success(): Promise<void> };
  /** Native version string (e.g. "1.2.0"); null on web and in a browser. */
  appVersion(): Promise<string | null>;
  /** The app came back to the foreground. Returns the unsubscribe function. */
  onForeground(listener: () => void): () => void;
  /** The app was opened through a link. Returns the unsubscribe function. */
  onAppUrlOpen(listener: (url: string) => void): () => void;
  /** The system back button was pressed (Android). No-op on web. Returns the unsubscribe function. */
  onBackButton(listener: (canGoBack: boolean) => void): () => void;
  /** Closes the app (Android). No-op on web. */
  exitApp(): void;
  /** Keeps the system status bar readable (light or dark text) as the theme changes. No-op on web. Returns the stop function. */
  watchStatusBar(): () => void;
  /**
   * Shares a link: the system share sheet in the app, the Web Share API in a browser that has it, otherwise a copy to the
   * clipboard. `text` is only used by the Web Share API. Rejects when sharing fails (not when the dialog is closed).
   */
  shareLink(link: { url: string; title: string; text?: string }): Promise<ShareLinkResult>;
}

/** Everything that differs between the web deployment and the Capacitor app. Chosen at build time. */
export interface Platform extends NativeFeatures {
  target: BuildTarget;
  /** Origin of the web deployment's API: "" on web (same origin), NEXT_PUBLIC_API_ORIGIN on mobile. */
  apiOrigin: string;
  /** Origin for links that leave the app (auth emails, shared stats links). */
  webOrigin(): string;
  createSupabaseClient(): SupabaseClient<Database>;
  ServiceWorker: ComponentType<{ children: ReactNode }>;
  /** Google Analytics script: rendered by the web build only (a no-op component on mobile, so the script is not in the export). */
  Analytics: ComponentType;
  saveFile(data: Blob, fileName: string): Promise<void>;
  createSyncPlatform(): SyncPlatform;
  /** Full page load of an in-app path (the app serves its root page for sub-paths, so mobile goes through `/?to=`). */
  hardNavigate(path: string): void;
}
