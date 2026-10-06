import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
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
