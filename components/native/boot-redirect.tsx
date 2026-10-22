"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { platform } from "@/lib/platform";
import { bootRedirectTarget, reloadRedirectTarget } from "@/lib/routes";

/**
 * Rendered by the root page. Capacitor answers every path without an extension with the root HTML, so on the app:
 * - `/?to=<path>` (a hard navigation, see `platform.hardNavigate`) opens <path>;
 * - a reload of a sub-path renders this page under that URL, and opens the URL again.
 * Does nothing on web.
 */
export function BootRedirect() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (platform.target !== "mobile" || done.current) return;
    done.current = true;
    const { pathname, search } = window.location;
    const target = bootRedirectTarget(search) ?? reloadRedirectTarget(pathname, search);
    if (target) router.replace(target);
  }, [router]);

  return null;
}
