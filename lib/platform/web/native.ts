import type { NativeFeatures } from "../types";

const noopUnsubscribe = () => {};

export const webNative: NativeFeatures = {
  nativePlatform: null,
  async keepAwake() {
    try {
      const sentinel = await navigator.wakeLock?.request("screen");
      if (sentinel) return async () => sentinel.release().catch(() => {});
    } catch {
      // Refused (battery saver, hidden tab): the screen may sleep.
    }
    return async () => {};
  },
  haptics: { tap: async () => {}, success: async () => {} },
  appVersion: async () => null,
  onForeground(listener) {
    const handler = () => {
      if (document.visibilityState === "visible") listener();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  },
  onAppUrlOpen: () => noopUnsubscribe,
  onBackButton: () => noopUnsubscribe,
  exitApp: () => {},
  watchStatusBar: () => noopUnsubscribe,
};
