import { BehaviorSubject, Subject } from "rxjs";
import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";

export function createFakePlatform(deviceId = "device-a", label = "Test · Device") {
  const connectivity = new BehaviorSubject(true);
  const foreground = new Subject<void>();
  let persistenceRequested = false;
  const platform: SyncPlatform = {
    connectivity$: connectivity.asObservable(),
    foreground$: foreground.asObservable(),
    requestPersistentStorage: async () => {
      persistenceRequested = true;
      return true;
    },
    getDeviceId: async () => deviceId,
    getDeviceLabel: () => label,
  };
  return {
    platform,
    setOnline: (online: boolean) => connectivity.next(online),
    foreground: () => foreground.next(),
    wasPersistenceRequested: () => persistenceRequested,
  };
}
