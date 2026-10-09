import { defer, distinctUntilChanged, filter, fromEvent, map, merge, startWith, type Observable } from "rxjs";
import type { SyncPlatform } from "./types";

const DEVICE_ID_KEY = "volleystats:device-id";
let memoryDeviceId: string | null = null;

export function deviceLabelFromUserAgent(userAgent: string): string {
  // Order matters: the Chromium-based browsers also say Chrome/ and Safari/, and the iOS browsers
  // (CriOS, FxiOS, EdgiOS) say Safari/ too.
  const browser = /Edg(A|iOS)?\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /(Firefox|FxiOS)\//.test(userAgent)
        ? "Firefox"
        : /(Chrome|CriOS)\//.test(userAgent)
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
          : /CrOS/.test(userAgent)
            ? "ChromeOS"
            : /Mac OS X/.test(userAgent)
              ? "macOS"
              : /Linux/.test(userAgent)
                ? "Linux"
                : "device";
  return `${browser} · ${os}`;
}

/**
 * A random v4 UUID. `crypto.randomUUID` only exists in secure contexts (not on
 * `http://<LAN-IP>`), so fall back to `getRandomValues`, then to Math.random. Never throws.
 */
export function generateDeviceId(cryptoApi: Partial<Crypto> | undefined = globalThis.crypto): string {
  try {
    if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  } catch {
    // fall through
  }
  const bytes = new Uint8Array(16);
  try {
    if (typeof cryptoApi?.getRandomValues !== "function") throw new Error("no getRandomValues");
    cryptoApi.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
        const id = generateDeviceId();
        localStorage.setItem(DEVICE_ID_KEY, id);
        return id;
      } catch {
        // Storage unavailable (private mode): one id for this page's lifetime.
        memoryDeviceId ??= generateDeviceId();
        return memoryDeviceId;
      }
    },
    getDeviceLabel: () => deviceLabelFromUserAgent(navigator.userAgent),
  };
}
