'use client';

import type { ReactNode } from 'react';
import { platform } from '@/lib/platform';

export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const ServiceWorker = platform.ServiceWorker;
  return <ServiceWorker>{children}</ServiceWorker>;
}
