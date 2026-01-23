"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect if the device is in landscape mode on mobile
 * Returns true when screen is wider than tall AND height is less than 500px (mobile landscape)
 */
export function useLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkLandscape = () => {
      const isLandscapeOrientation = window.innerWidth > window.innerHeight;
      const isMobileHeight = window.innerHeight < 500;
      setIsLandscape(isLandscapeOrientation && isMobileHeight);
    };

    // Initial check
    checkLandscape();

    // Listen to resize and orientation change
    window.addEventListener("resize", checkLandscape);
    window.addEventListener("orientationchange", checkLandscape);

    return () => {
      window.removeEventListener("resize", checkLandscape);
      window.removeEventListener("orientationchange", checkLandscape);
    };
  }, []);

  return isLandscape;
}
