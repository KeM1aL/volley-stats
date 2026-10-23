"use client";

import { useSyncExternalStore } from "react";
import { platform } from "@/lib/platform";

const noSubscription = () => () => {};

/** True in the installed app (iOS/Android), false on the web and in a browser. Decided after mount, so the server render matches the first client render. */
export function useNativeApp(): boolean {
  return useSyncExternalStore(noSubscription, () => platform.nativePlatform !== null, () => false);
}
