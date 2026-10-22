import type { NativeFeatures, ShareLinkResult } from "../types";

const noopUnsubscribe = () => {};

/** Web Share API when the browser has it (closing the dialog is not a failure), otherwise the link goes to the clipboard. */
async function shareLinkWeb({ url, title, text }: { url: string; title: string; text?: string }): Promise<ShareLinkResult> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      throw error;
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

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
  shareLink: shareLinkWeb,
};
