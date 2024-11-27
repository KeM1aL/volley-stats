"use client";

import * as React from "react";
import { Fullscreen, Minimize } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function FullScreenToggle() {
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
      {isFullscreen ? <Minimize className="h-[1.5rem] w-[1.5rem]" /> : <Fullscreen className="h-[1.5rem] w-[1.5rem]" />}
      <span className="sr-only">Toggle fullscreen</span>
    </Button>
  );
}