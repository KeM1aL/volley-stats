import { allowNextUnload } from "@/hooks/use-unsent-guard";
import type { LeaveDecision } from "@/components/providers/leave-guard-provider";
import { routes } from "@/lib/routes";

/**
 * How the installed app leaves the live match, for the toolbar button and Android back alike: nothing on "stay"; after "leave"
 * the unload prompt is skipped once; then back, or to Matches when the page was opened with nothing behind it (a link).
 */
export function leaveLiveMatch(
  router: { back: () => void; replace: (href: string) => void },
  decision: LeaveDecision,
  canGoBack: boolean,
): void {
  if (decision === "stay") return;
  if (decision === "leave") allowNextUnload();
  if (canGoBack) router.back();
  else router.replace(routes.matches());
}
