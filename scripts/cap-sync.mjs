#!/usr/bin/env node
// Builds the static export (BUILD_TARGET=mobile), stamps package.json's version into the native projects and copies the export into the native projects (`cap sync`).
// Node runs both steps so it works on any OS. NEXT_PUBLIC_API_ORIGIN and NEXT_PUBLIC_WEB_ORIGIN must be set.
import { spawnSync } from 'node:child_process';

for (const [command, args] of [['node', ['scripts/build-mobile.mjs']], ['node', ['scripts/sync-app-version.mjs']], ['npx', ['cap', 'sync']]]) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
