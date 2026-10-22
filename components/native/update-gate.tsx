"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppConfig } from "@/lib/api/app-config";
import { platform } from "@/lib/platform";
import { normalizePath } from "@/lib/routes";
import { supabase } from "@/lib/supabase/client";
import { updateStatus, updateUi, type UpdateStatus } from "@/lib/utils/version";

const LIVE_PATH = "/matches/live";
const noSubscription = () => () => {};

/** Opens the store page outside the app. */
function openStore(url: string) {
  window.open(url, "_system");
}

/**
 * Checks the minimum app version in `app_config` at start and whenever the app returns to the foreground.
 * A newer version available: a dismissible banner. Below the minimum: a full-screen page. Neither is shown over a live match
 * (it appears once the live page is left). Renders nothing on web, and nothing when the check cannot be made.
 */
export function UpdateGate() {
  const t = useTranslations("common.update");
  const pathname = usePathname();
  // Decided after mount: the platform is only known in the browser, and the server render must match the first client render.
  const nativePlatform = useSyncExternalStore(noSubscription, () => platform.nativePlatform, () => null);
  const [check, setCheck] = useState<{ status: UpdateStatus; storeUrl: string | null }>({ status: "ok", storeUrl: null });
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!nativePlatform) return;
    let active = true;
    const run = async () => {
      if (!navigator.onLine) return;
      const [config, version] = await Promise.all([getAppConfig(supabase, nativePlatform), platform.appVersion()]);
      // A failed read keeps what is known: an unreachable config must neither lock anyone out nor lift a block.
      if (active && config) setCheck({ status: updateStatus(version, config), storeUrl: config.store_url });
    };
    void run().catch(() => {});
    const off = platform.onForeground(() => void run().catch(() => {}));
    return () => {
      active = false;
      off();
    };
  }, [nativePlatform]);

  if (!nativePlatform) return null;
  const ui = updateUi(check.status, {
    onLivePage: normalizePath(pathname ?? "/") === LIVE_PATH,
    bannerDismissed,
  });
  if (ui === "none") return null;
  const { storeUrl } = check;

  if (ui === "block") {
    return (
      <div
        className="safe-area-inset fixed inset-0 z-[100] flex items-center justify-center bg-background p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="update-required-title"
        data-testid="update-required"
      >
        <div className="w-full max-w-sm space-y-4 text-center">
          <RefreshCw className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 id="update-required-title" className="text-xl font-semibold">{t("requiredTitle")}</h1>
          <p className="text-muted-foreground">{t("requiredBody")}</p>
          {storeUrl && (
            <Button type="button" className="w-full" onClick={() => openStore(storeUrl)}>
              {t("action")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-(--tab-bar-offset) z-40 px-3 pb-[calc(var(--fixed-bottom-safe-area)+0.75rem)]"
      data-testid="update-banner"
    >
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg border bg-background p-3 shadow-lg">
        <p className="flex-1 text-sm">{t("available")}</p>
        {storeUrl && (
          <Button type="button" size="sm" onClick={() => openStore(storeUrl)}>
            {t("action")}
          </Button>
        )}
        <Button type="button" size="icon" variant="ghost" aria-label={t("dismiss")} onClick={() => setBannerDismissed(true)}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
