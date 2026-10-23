"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { platform } from "@/lib/platform";
import { bootRedirectDecision, normalizePath, type BootForward } from "@/lib/routes";

const FORWARD_KEY = "volleystats:boot-forward";
const CLEAR_AFTER_MS = 1500;

function readForward(): BootForward | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(FORWARD_KEY) ?? "null");
    return parsed && typeof parsed.target === "string" && typeof parsed.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeForward(forward: BootForward): boolean {
  try {
    sessionStorage.setItem(FORWARD_KEY, JSON.stringify(forward));
    return true;
  } catch {
    return false;
  }
}

function clearForward(): void {
  try {
    sessionStorage.removeItem(FORWARD_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

/**
 * Rendered by the root page. Capacitor answers every path without an extension with the root HTML, so on the app:
 * - `/?to=<path>` (a hard navigation, see `platform.hardNavigate`) opens <path>;
 * - a reload of a sub-path renders this page under that URL, and opens the URL again.
 * A target is forwarded once within a few seconds: a path the router cannot open (unknown page) falls back to a page load
 * that lands here again, and then the landing page stays, under `/`. Does nothing on web.
 */
export function BootRedirect() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (platform.target !== "mobile" || done.current) return;
    done.current = true;
    const { pathname, search } = window.location;
    const decision = bootRedirectDecision(pathname, search, readForward(), Date.now());
    if (decision.action === "abort") {
      window.history.replaceState(null, "", "/");
    } else if (decision.action === "forward") {
      // Without a marker a failing path could reload forever: only forward when it can be written.
      if (writeForward({ target: decision.target, at: Date.now() })) {
        router.replace(decision.target);
        // The router opened it without a page load (this script is still running, away from the root): allow it again.
        // A page load that fell back destroys this script before the timer fires, and the marker stays.
        window.setTimeout(() => {
          if (normalizePath(window.location.pathname) !== "/") clearForward();
        }, CLEAR_AFTER_MS);
      }
    }
  }, [router]);

  return null;
}
