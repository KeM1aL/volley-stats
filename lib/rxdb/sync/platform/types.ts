import type { Observable } from "rxjs";

/**
 * Platform signals the sync core needs. The web implementation uses browser
 * events; a Capacitor or Expo build provides its own without touching the core.
 */
export interface SyncPlatform {
  /** Emits the current connectivity, then every change. */
  connectivity$: Observable<boolean>;
  /** Emits when the app comes back to the foreground. */
  foreground$: Observable<void>;
  /** Asks the platform not to evict local data during long offline periods. */
  requestPersistentStorage(): Promise<boolean>;
  /** A random id generated once per install and kept. */
  getDeviceId(): Promise<string>;
  /** A short readable label, e.g. "Chrome · Android". */
  getDeviceLabel(): string;
}
