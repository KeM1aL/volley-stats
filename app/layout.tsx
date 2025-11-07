import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { LocalDatabaseProvider } from '@/components/providers/local-database-provider';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation';
import { LoadingBar } from '@/components/ui/loading-bar';
import { AuthProvider } from '@/contexts/auth-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VolleyStats for Dummies',
  description: 'Professional volleyball statistics tracking and analysis',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VolleyStats',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'VolleyStats for Dummies',
    title: 'VolleyStats for Dummies',
    description: 'Professional volleyball statistics tracking and analysis',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VolleyStats for Dummies',
    description: 'Professional volleyball statistics tracking and analysis',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#0f172a" />
        <meta name="apple-mobile-web-app-title" content="VolleyStats" />
        <meta name="application-name" content="VolleyStats" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <LocalDatabaseProvider>
              <LoadingBar />
              <div className="min-h-screen bg-background">
                <Navigation />
                <main className="2xl:container 2xl:mx-auto px-2 py-1">
                  {children}
                </main>
              </div>
              <Toaster />
            </LocalDatabaseProvider>
            </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
