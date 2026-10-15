#!/usr/bin/env node
// `next build` for the mobile target (static export in out/). Node sets the variable so it works on any OS.
import { spawnSync } from 'node:child_process';

const result = spawnSync('next', ['build'], { stdio: 'inherit', shell: true, env: { ...process.env, BUILD_TARGET: 'mobile' } });
process.exit(result.status ?? 1);
