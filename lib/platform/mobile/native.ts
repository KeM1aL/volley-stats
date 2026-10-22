import { App } from "@capacitor/app";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { webNative } from "../web/native";
import type { NativeFeatures } from "../types";

/** Subscribes to a Capacitor listener and returns a synchronous unsubscribe (removes the listener once registered). */
function listen(register: () => Promise<{ remove(): Promise<void> }>): () => void {
  const handle = register().catch(() => null);
  return () => {
    void handle.then((registered) => registered?.remove());
  };
}

// In a browser (the static export served without the app shell) every member behaves like web.
const native = (): boolean => Capacitor.isNativePlatform();

function nativePlatformName(): "ios" | "android" | null {
  if (!native()) return null;
  const name = Capacitor.getPlatform();
  return name === "ios" || name === "android" ? name : null;
}

export const mobileNative: NativeFeatures = {
  // Fixed when the module loads: the shell never changes while the page lives.
  nativePlatform: nativePlatformName(),
  async keepAwake() {
    if (!native()) return webNative.keepAwake();
    try {
      await KeepAwake.keepAwake();
    } catch {
      return async () => {};
    }
    return async () => {
      await KeepAwake.allowSleep().catch(() => {});
    };
  },
  haptics: {
    async tap() {
      if (!native()) return;
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    },
    async success() {
      if (!native()) return;
      await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    },
  },
  async appVersion() {
    if (!native()) return null;
    try {
      return (await App.getInfo()).version;
    } catch {
      return null;
    }
  },
  onForeground(listener) {
    if (!native()) return webNative.onForeground(listener);
    return listen(() => App.addListener("appStateChange", (state) => state.isActive && listener()));
  },
  onAppUrlOpen(listener) {
    if (!native()) return () => {};
    return listen(() => App.addListener("appUrlOpen", (event) => listener(event.url)));
  },
  onBackButton(listener) {
    if (!native()) return () => {};
    return listen(() => App.addListener("backButton", (event) => listener(event.canGoBack)));
  },
  exitApp() {
    if (native()) void App.exitApp();
  },
};
