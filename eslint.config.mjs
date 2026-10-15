import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // Server-only modules: only in *.web.ts(x) files (web target), proxy.ts and lib/server/.
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.web.ts', '**/*.web.tsx', 'proxy.ts', 'lib/server/**', 'tests/**', 'scripts/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'next/headers', message: 'Server-only: use it in a *.web.ts file or lib/server/.' },
          { name: 'next/server', message: 'Server-only: use it in a *.web.ts file or lib/server/.' },
          { name: 'next-intl/server', message: 'Server-only: use it in a *.web.ts file or lib/server/.' },
          { name: '@supabase/ssr', message: 'Only lib/platform/ and lib/server/ create Supabase clients.' },
          { name: '@platform-impl', message: 'Import platform from @/lib/platform.' },
        ],
        patterns: [{ group: ['@capacitor/*'], message: 'Only lib/platform/ talks to Capacitor.' }],
      }],
    },
  },
  {
    // The platform seam itself.
    files: ['lib/platform/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Core folders stay free of React and Next.
    files: ['lib/{api,auth,commands,importers,keyboard,matches,rxdb,stats,templates,types,utils}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: ['react', 'react-dom', 'next', 'next-intl', 'next/headers', 'next/server', 'next-intl/server', '@supabase/ssr', '@platform-impl']
          .map((name) => ({ name, message: 'Core folders stay free of React, Next and platform code.' })),
        patterns: [{ group: ['next/*', '@capacitor/*'], message: 'Core folders stay free of Next and platform code.' }],
      }],
    },
  },
  globalIgnores([
    '.next/**',
    '.worktrees/**',
    'next-env.d.ts',
    'node_modules/**',
    'playwright/**',
    'playwright-report/**',
    'public/**',
    'supabase/**',
    'test-results/**',
  ]),
]);
