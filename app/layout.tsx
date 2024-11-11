import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { DatabaseProvider } from '@/components/providers/database-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VolleyStats for Dummies',
  description: 'Professional volleyball statistics tracking and analysis',
  manifest: '/manifest.webmanifest',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ],
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
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <DatabaseProvider>
              <div className="min-h-screen bg-background">
                <Navigation />
                <main className="2xl:container 2xl:mx-auto px-4 py-4">
                  {children}
                </main>
              </div>
              <Toaster />
            </DatabaseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}