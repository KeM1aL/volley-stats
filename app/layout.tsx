import './globals.css';
import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { LocaleProvider, ProfileLocaleSync } from '@/components/providers/locale-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { LocalDatabaseProvider } from '@/components/providers/local-database-provider';
import { SyncStatusProvider } from '@/components/providers/sync-status-provider';
import { LeaveGuardProvider } from '@/components/providers/leave-guard-provider';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation';
import { LoadingBar } from '@/components/ui/loading-bar';
import { AuthProvider } from '@/contexts/auth-context';
import { AuthGuard } from '@/components/auth/auth-guard';
import { OfflineGate } from '@/components/offline-gate';
import { KeyboardProvider } from '@/contexts/keyboard-context';
import { Analytics } from '@/components/analytics';
import { ServiceWorkerProvider } from '@/components/providers/service-worker-provider';
import { isMobileBuild } from '@/lib/platform/build-target';
import { StatusBarSync } from '@/components/providers/status-bar-sync';
import { NativeBridge } from '@/components/native/native-bridge';
import { UpdateGate } from '@/components/native/update-gate';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Metadata values from messages/en/common.json app section
const APP_TITLE_LONG = 'VolleyStats for Dummies';
const APP_TITLE_SHORT = 'VolleyStats';
const APP_DESCRIPTION = 'Professional volleyball statistics tracking and analysis';

export const metadata: Metadata = {
  title: APP_TITLE_LONG,
  description: APP_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_TITLE_SHORT,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: APP_TITLE_LONG,
    title: APP_TITLE_LONG,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_TITLE_LONG,
    description: APP_DESCRIPTION,
  },
};

// Note: Metadata for layout uses static values as next-intl doesn't work with server-side metadata directly.
// These metadata values are in English (default). For locale-specific metadata, use generateMetadata()
// in individual page files or consider using a metadata route handler.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" /> */}
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#0f172a" />
        <meta name="apple-mobile-web-app-title" content={APP_TITLE_SHORT} />
        <meta name="application-name" content={APP_TITLE_SHORT} />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <ServiceWorkerProvider>
          <LocaleProvider>
            <KeyboardProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                storageKey="theme"
                enableSystem
                disableTransitionOnChange
              >
                <AuthProvider>
                  <ProfileLocaleSync />
                  <LocalDatabaseProvider>
                    <SyncStatusProvider>
                      <LeaveGuardProvider>
                        <NativeBridge />
                        <Suspense fallback={null}><LoadingBar /></Suspense>
                        {/* Mobile build only: the page draws under the system bars, so these strips keep scrolled content out from under them. Below the dialog overlays (z-50). */}
                        {isMobileBuild && <div className="fixed inset-x-0 top-0 z-40 h-(--safe-area-inset-top) bg-background" aria-hidden="true" />}
                        {isMobileBuild && <div className="fixed inset-x-0 bottom-0 z-40 h-(--safe-area-inset-bottom) bg-background" aria-hidden="true" />}
                        <div className={isMobileBuild ? "keyboard-layout-grid safe-area-inset bg-background" : "keyboard-layout-grid bg-background"}>
                          <header>
                            <Navigation />
                          </header>
                          <main className="keyboard-main-content 2xl:container 2xl:mx-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
                            <AuthGuard><OfflineGate>{children}</OfflineGate></AuthGuard>
                          </main>
                          <div className="keyboard-spacer" aria-hidden="true" />
                        </div>
                        <Toaster />
                      </LeaveGuardProvider>
                    </SyncStatusProvider>
                  </LocalDatabaseProvider>
                </AuthProvider>
                {/* Outside AuthProvider, which replaces its children with a loading screen while the profile loads: inside, the check would run again each time. It needs no session (app_config is public). */}
                <UpdateGate />
                <StatusBarSync />
              </ThemeProvider>
            </KeyboardProvider>
          </LocaleProvider>
        </ServiceWorkerProvider>
      </body>
      <Analytics />
    </html>
  );
}
