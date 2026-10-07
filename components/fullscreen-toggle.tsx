"use client";

import * as React from "react";
import { Fullscreen, Minimize } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function FullScreenToggle() {
  const t = useTranslations("common");
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => isFullscreen ? document.exitFullscreen() : document.body.requestFullscreen()}
    >
      {isFullscreen ? <Minimize className="h-6 w-6" /> : <Fullscreen className="h-6 w-6" />}
      <span className="sr-only">{t("ui.toggleFullscreen")}</span>
    </Button>
  );
}