"use client";

import { useReducer, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LAST_LIVE_MATCH_KEY } from "@/components/providers/leave-guard-provider";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { normalizePath, requiresConnection } from "@/lib/routes";
import { supabaseConfig } from "@/lib/platform/supabase-config";

function readLastLiveMatch(): string | null {
  try {
    return sessionStorage.getItem(LAST_LIVE_MATCH_KEY);
  } catch {
    return null;
  }
}

/**
 * Screens that load everything from Supabase (lists, team pages) would open empty offline. A screen
 * like that opened offline shows this offline screen instead (same test id and texts as
 * public/offline.html) and is not mounted; once the connection is back it mounts and loads its data.
 * A screen already open when the connection drops keeps what it shows. Other screens, the live match
 * among them, always render.
 */
export function OfflineGate({ children }: { children: ReactNode }) {
  const path = normalizePath(usePathname() ?? "/");
  const { isOnline } = useOnlineStatus();
  // Retry re-reads navigator.onLine (a missed `online` event must not keep the screen gated), then probes the server.
  const [, recheck] = useReducer((count: number) => count + 1, 0);
  // Rendered in the browser only (LocaleProvider renders after mount). navigator.onLine is the truth,
  // also before useOnlineStatus's first effect, so a page opened offline never mounts; the hook
  // re-renders this on the online/offline events.
  const online = typeof navigator === "undefined" ? isOnline : navigator.onLine;
  const opensGated = !online && requiresConnection(path);
  // Decided when a screen opens; only the connection coming back lifts it.
  const [gate, setGate] = useState<{ path: string; gated: boolean }>({ path, gated: opensGated });
  if (gate.path !== path) setGate({ path, gated: opensGated });
  else if (gate.gated && online) setGate({ path, gated: false });
  const gated = gate.path === path ? gate.gated && !online : opensGated;

  const retry = async () => {
    recheck();
    if (navigator.onLine) return;
    // navigator.onLine can stay false while the device is online (some Android WebViews): ask the server.
    if (await probeConnection()) setGate((current) => (current.path === path ? { path, gated: false } : current));
  };

  if (!gated) return <>{children}</>;
  return <OfflineScreen onRetry={retry} />;
}

const PROBE_TIMEOUT_MS = 5_000;

/** Whether Supabase answers (its auth health endpoint), within PROBE_TIMEOUT_MS. */
async function probeConnection(): Promise<boolean> {
  try {
    const { url, anonKey } = supabaseConfig();
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function OfflineScreen({ onRetry }: { onRetry: () => Promise<void> }) {
  const t = useTranslations("common.offline");
  const router = useRouter();
  const lastLiveMatch = readLastLiveMatch();
  const [checking, setChecking] = useState(false);
  const retry = async () => {
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 text-center" data-testid="offline-page">
        <WifiOff className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("body")}</p>
        <div className="flex flex-col gap-2">
          {lastLiveMatch ? (
            <Button type="button" onClick={() => router.push(lastLiveMatch)}>
              {t("backToLive")}
            </Button>
          ) : (
            // Never to /matches: it needs a connection too.
            <Button type="button" onClick={() => window.history.back()}>
              {t("goBack")}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={checking} onClick={() => void retry()}>
            {t("retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
