import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { getUserLocale } from '@/lib/i18n/locale';
import { ThemeProvider } from '@/components/theme-provider';
import { LocalDatabaseProvider } from '@/components/providers/local-database-provider';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation';
import { LoadingBar } from '@/components/ui/loading-bar';
import { AuthProvider } from '@/contexts/auth-context';
import { KeyboardProvider } from '@/contexts/keyboard-context';
import { GoogleAnalytics } from '@next/third-parties/google'

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getUserLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
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
        <NextIntlClientProvider messages={messages} locale={locale}>
          <KeyboardProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              storageKey="theme"
              enableSystem
              disableTransitionOnChange
            >
              <AuthProvider>
                <LocalDatabaseProvider>
                  <LoadingBar />
                  <div className="keyboard-layout-grid bg-background">
                    <header>
                      <Navigation />
                    </header>
                    <main className="keyboard-main-content 2xl:container 2xl:mx-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
                      {children}
                    </main>
                    <div className="keyboard-spacer" aria-hidden="true" />
                  </div>
                  <Toaster />
                </LocalDatabaseProvider>
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </NextIntlClientProvider>
      </body>
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!} />}
    </html>
  );
}
