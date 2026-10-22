"use client";

import { ReactNode } from 'react';
import { useLandscape } from '@/hooks/use-landscape';
import { isMobileBuild } from '@/lib/platform/build-target';
import { useNativeApp } from '@/components/navigation/use-native-app';
import { LiveAppToolbar } from '@/components/native/live-app-toolbar';

export default function LiveMatchLayout({
  children,
}: {
  children: ReactNode;
}) {
  const isLandscape = useLandscape();
  const nativeApp = useNativeApp();

  // This layout uses fixed positioning to completely break out of the parent's scroll context
  // The navigation header is h-14 (56px) in normal mode, h-10 (40px) in landscape mode.
  // Mobile build only: the system bars (status bar, gesture bar, cutout) add the safe-area insets around it.
  // Installed app: no header at all; the toolbar (back button, sync status) is the first row of this block instead.
  const position = nativeApp
    ? 'fixed top-(--safe-area-inset-top) bottom-(--safe-area-inset-bottom) left-(--safe-area-inset-left) right-(--safe-area-inset-right) flex flex-col'
    : isMobileBuild
    ? `fixed bottom-(--safe-area-inset-bottom) left-(--safe-area-inset-left) right-(--safe-area-inset-right) ${isLandscape ? 'top-[calc(2.5rem+var(--safe-area-inset-top))]' : 'top-[calc(3.5rem+var(--safe-area-inset-top))]'}`
    : `fixed inset-0 ${isLandscape ? 'top-10' : 'top-14'}`;
  return (
    <div
      className={`${position} bg-background overflow-hidden`}
      id="live-match"
    >
      <LiveAppToolbar />
      <div className={nativeApp ? 'min-h-0 flex-1 px-2 py-1' : 'h-full px-2 py-1'}>
        {children}
      </div>
    </div>
  );
}
