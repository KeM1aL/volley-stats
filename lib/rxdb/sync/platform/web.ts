import { defer, distinctUntilChanged, filter, fromEvent, map, merge, startWith, type Observable } from "rxjs";
import type { SyncPlatform } from "./types";

const DEVICE_ID_KEY = "volleystats:device-id";
let memoryDeviceId: string | null = null;

export function deviceLabelFromUserAgent(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone/.test(userAgent)
      ? "iPhone"
      : /iPad/.test(userAgent)
        ? "iPad"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "device";
  return `${browser} · ${os}`;
}

export function createWebPlatform(): SyncPlatform {
  const connectivity$: Observable<boolean> = defer(() =>
    merge(
      fromEvent(window, "online").pipe(map(() => true)),
      fromEvent(window, "offline").pipe(map(() => false))
    ).pipe(startWith(navigator.onLine), distinctUntilChanged())
  );
  const foreground$: Observable<void> = defer(() =>
    fromEvent(document, "visibilitychange").pipe(
      filter(() => document.visibilityState === "visible"),
      map(() => undefined)
    )
  );
  return {
    connectivity$,
    foreground$,
    async requestPersistentStorage() {
      try {
        return (await navigator.storage?.persist?.()) ?? false;
      } catch {
        return false;
      }
    },
    async getDeviceId() {
      try {
        const saved = localStorage.getItem(DEVICE_ID_KEY);
        if (saved) return saved;
        const id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
        return id;
      } catch {
        // Storage unavailable (private mode): one id for this page's lifetime.
        memoryDeviceId ??= crypto.randomUUID();
        return memoryDeviceId;
      }
    },
    getDeviceLabel: () => deviceLabelFromUserAgent(navigator.userAgent),
  };
}
