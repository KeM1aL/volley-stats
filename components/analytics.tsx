'use client';

import { platform } from '@/lib/platform';

/** Google Analytics on the web build only; the Capacitor app ships no analytics script. */
export function Analytics() {
  const PlatformAnalytics = platform.Analytics;
  return <PlatformAnalytics />;
}
