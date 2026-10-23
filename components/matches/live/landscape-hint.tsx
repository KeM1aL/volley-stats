"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landscapeHintKey, shouldShowLandscapeHint } from "@/lib/matches/landscape-hint";

function readDismissed(matchId: string): boolean {
  try {
    return localStorage.getItem(landscapeHintKey(matchId)) === "1";
  } catch {
    return false;
  }
}

/** A dismissible bar asking a touch device held in portrait to turn for the scoring layout. */
export function LandscapeHint({ matchId }: { matchId: string }) {
  const t = useTranslations("matches");
  // Decided after mount: server-rendered and exported HTML cannot know the device.
  const [state, setState] = useState<{ portrait: boolean; coarsePointer: boolean; dismissed: boolean } | null>(null);

  useEffect(() => {
    const portraitQuery = window.matchMedia("(orientation: portrait)");
    const pointerQuery = window.matchMedia("(pointer: coarse)");
    const update = () =>
      setState((current) => ({
        portrait: portraitQuery.matches,
        coarsePointer: pointerQuery.matches,
        dismissed: current?.dismissed ?? readDismissed(matchId),
      }));
    update();
    portraitQuery.addEventListener("change", update);
    pointerQuery.addEventListener("change", update);
    return () => {
      portraitQuery.removeEventListener("change", update);
      pointerQuery.removeEventListener("change", update);
    };
  }, [matchId]);

  if (!state || !shouldShowLandscapeHint(state)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(landscapeHintKey(matchId), "1");
    } catch (error) {
      console.warn("Could not remember the dismissed landscape hint:", error);
    }
    setState({ ...state, dismissed: true });
  };

  return (
    <div
      role="status"
      data-testid="landscape-hint"
      className="flex shrink-0 items-center gap-2 border-b bg-muted px-3 py-1.5 text-sm text-muted-foreground"
    >
      <RotateCw className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{t("live.landscapeHint.message")}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0"
        aria-label={t("live.landscapeHint.dismiss")}
        data-testid="landscape-hint-dismiss"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
