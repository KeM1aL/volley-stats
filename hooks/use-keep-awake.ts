"use client";

import { useEffect } from "react";
import { platform } from "@/lib/platform";

/** Keeps the screen on while `active`; lets it sleep again when `active` turns false or the component unmounts. */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let release: (() => Promise<void>) | null = null;

    platform
      .keepAwake()
      .then((fn) => {
        if (cancelled) void fn().catch(() => {});
        else release = fn;
      })
      .catch((error) => console.warn("Could not keep the screen awake:", error));

    // The browser drops a wake lock when the tab is hidden: acquire it again on return.
    const reacquire = platform.onForeground(() => {
      if (cancelled || !release) return;
      const previous = release;
      release = null;
      void previous()
        .catch(() => {})
        .then(() => platform.keepAwake())
        .then((fn) => {
          if (cancelled) void fn().catch(() => {});
          else release = fn;
        })
        .catch((error) => console.warn("Could not keep the screen awake:", error));
    });

    return () => {
      cancelled = true;
      reacquire();
      void release?.().catch((error) => console.warn("Could not release the screen lock:", error));
    };
  }, [active]);
}
