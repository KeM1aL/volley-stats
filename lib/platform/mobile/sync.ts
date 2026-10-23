import { App } from "@capacitor/app";
import { Device } from "@capacitor/device";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { distinctUntilChanged, Observable } from "rxjs";
import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";
import { deviceLabelFromUserAgent, generateDeviceId, requestPersistentStorage } from "../shared/sync";

const DEVICE_ID_KEY = "volleystats:device-id";

function nativeLabel(info: { model: string; operatingSystem: string }): string {
  const os = info.operatingSystem === "ios" ? "iOS" : info.operatingSystem === "android" ? "Android" : "device";
  return `${info.model || "Device"} · ${os}`;
}

export function createNativeSyncPlatform(): SyncPlatform {
  const connectivity$ = new Observable<boolean>((subscriber) => {
    let closed = false;
    let changed = false;
    const handle = Network.addListener("networkStatusChange", (status) => {
      changed = true;
      if (!closed) subscriber.next(status.connected);
    });
    // The first value is the current status, unless a change already arrived while asking.
    Network.getStatus().then(
      (status) => {
        if (!closed && !changed) subscriber.next(status.connected);
      },
      () => {}
    );
    handle.catch((error) => subscriber.error(error));
    return () => {
      closed = true;
      void handle.then((registered) => registered.remove()).catch(() => {});
    };
  }).pipe(distinctUntilChanged());

  const foreground$ = new Observable<void>((subscriber) => {
    let closed = false;
    const handle = App.addListener("appStateChange", (state) => {
      if (state.isActive && !closed) subscriber.next();
    });
    handle.catch((error) => subscriber.error(error));
    return () => {
      closed = true;
      void handle.then((registered) => registered.remove()).catch(() => {});
    };
  });

  let label = deviceLabelFromUserAgent(navigator.userAgent);
  // getDeviceLabel is synchronous: the user agent stands in until the plugin answers.
  Device.getInfo().then(
    (info) => {
      label = nativeLabel(info);
    },
    () => {}
  );

  let deviceId: Promise<string> | null = null;
  const readOrCreateDeviceId = async () => {
    const { value } = await Preferences.get({ key: DEVICE_ID_KEY });
    if (value) return value;
    const id = generateDeviceId();
    await Preferences.set({ key: DEVICE_ID_KEY, value: id });
    return id;
  };

  return {
    connectivity$,
    foreground$,
    requestPersistentStorage,
    getDeviceId() {
      deviceId ??= readOrCreateDeviceId().catch((error) => {
        deviceId = null;
        throw error;
      });
      return deviceId;
    },
    getDeviceLabel: () => label,
  };
}
