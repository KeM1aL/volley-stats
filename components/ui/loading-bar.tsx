"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function LoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>();

  useEffect(() => {
    // Reset and start loading on route change
    setLoading(true);
    setProgress(0);

    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    // Complete the progress after a short delay
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      
      // Hide the bar after completion
      const hideTimeout = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
      
      setTimeoutId(hideTimeout);
    }, 300);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [pathname, searchParams]);

  if (!loading && progress === 0) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 h-1 bg-primary/20 z-50 transition-opacity duration-200",
        loading ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className="h-full bg-primary transition-all duration-200 ease-in-out"
        style={{
          width: `${progress}%`,
          transition: "width 200ms ease-in-out",
        }}
      />
    </div>
  );
}