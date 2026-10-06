'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';

// Registers /serwist/sw.js (scope "/"). Disabled in development like the
// previous next-pwa setup. reloadOnOnline is off: a reload on reconnect would
// interrupt live match tracking.
export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === 'development'}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
