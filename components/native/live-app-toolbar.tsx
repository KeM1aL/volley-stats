"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirmLeave } from "@/components/providers/leave-guard-provider";
import { useNativeApp } from "@/components/navigation/use-native-app";
import { SyncBadge } from "@/components/sync/sync-badge";
import { allowNextUnload } from "@/hooks/use-unsent-guard";
import { routes } from "@/lib/routes";

/** Height of the toolbar, for the live layout (it has no header in the installed app). */
export const LIVE_APP_TOOLBAR_CLASS = "h-9";

/**
 * Installed app only: the live match page has no header and no tab bar, so this small bar holds the back button (through the
 * existing leave confirmation, then back, or to Matches when the page was opened with nothing behind it) and the compact sync status.
 */
export function LiveAppToolbar() {
  const nativeApp = useNativeApp();
  const router = useRouter();
  const t = useTranslations("navigation");
  const { confirmLeave } = useConfirmLeave();
  if (!nativeApp) return null;

  const goBack = async () => {
    const decision = await confirmLeave();
    if (decision === "stay") return;
    if (decision === "leave") allowNextUnload();
    if (window.history.length > 1) router.back();
    else router.replace(routes.matches());
  };

  return (
    <div className={`flex ${LIVE_APP_TOOLBAR_CLASS} shrink-0 items-center gap-1 px-1`} data-testid="live-app-toolbar">
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("actions.back")} data-testid="live-back" onClick={() => void goBack()}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <SyncBadge compact />
    </div>
  );
}
