"use client";

import { ReactNode } from 'react';
import { useLandscape } from '@/hooks/use-landscape';

export default function LiveMatchLayout({
  children,
}: {
  children: ReactNode;
}) {
  const isLandscape = useLandscape();

  // This layout uses fixed positioning to completely break out of the parent's scroll context
  // The navigation header is h-14 (56px) in normal mode, h-10 (40px) in landscape mode
  return (
    <div
      className={`fixed inset-0 ${isLandscape ? 'top-10' : 'top-14'} bg-background overflow-hidden`}
      id="live-match"
    >
      <div className="h-full px-2 py-1">
        {children}
      </div>
    </div>
  );
}
