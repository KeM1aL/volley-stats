'use client';

import { useEffect } from 'react';
import { platform } from '@/lib/platform';

/** In the installed app, keeps the status bar text readable on the current theme. Renders nothing; no-op on web. */
export function StatusBarSync() {
  useEffect(() => platform.watchStatusBar(), []);
  return null;
}
