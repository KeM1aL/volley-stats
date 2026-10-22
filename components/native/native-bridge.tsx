"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConfirmLeave } from "@/components/providers/leave-guard-provider";
import { backAction } from "@/lib/native/back-action";
import { platform } from "@/lib/platform";
import { appRouteFromUrl } from "@/lib/routes";

const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/** Renders nothing: connects the app shell's incoming links and Android back button to the router. Does nothing on web. */
export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, confirmLeave } = useConfirmLeave();
  // The listeners are registered once; they read the latest values from here.
  const latest = useRef({ router, pathname, isActive, confirmLeave });
  useEffect(() => {
    latest.current = { router, pathname, isActive, confirmLeave };
  });

  useEffect(() => {
    // Decided after mount: the platform is only known in the browser.
    if (!platform.nativePlatform) return;

    const offUrl = platform.onAppUrlOpen((url) => {
      latest.current.router.push(appRouteFromUrl(url, platform.webOrigin()));
    });

    const offBack = platform.onBackButton((canGoBack) => {
      const { router: current, pathname: path, isActive: guardActive, confirmLeave: ask } = latest.current;
      const action = backAction({
        dialogOpen: !!document.querySelector(OPEN_DIALOG),
        guardActive: guardActive(),
        canGoBack,
        pathname: path ?? "/",
      });
      switch (action) {
        case "close-dialog":
          // Radix closes on Escape from anywhere in the document.
          (document.activeElement ?? document.body).dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
          );
          break;
        case "confirm-leave":
          void ask().then((decision) => {
            if (decision !== "leave") return;
            // Opened as the first history entry (a link): there is nothing to go back to.
            if (canGoBack) current.back();
            else current.replace("/");
          });
          break;
        case "back":
          current.back();
          break;
        case "home":
          current.replace("/");
          break;
        case "exit":
          platform.exitApp();
          break;
      }
    });

    return () => {
      offUrl();
      offBack();
    };
  }, []);

  return null;
}
