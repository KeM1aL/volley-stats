#!/usr/bin/env node
// Runs the Playwright e2e suite against its own production server: builds the app (`next build`), picks a free port,
// starts `next start`, waits until it answers, runs `playwright test <args>` with BASE_URL pointing at it, then stops the
// whole server process tree. A production server, not `next dev`: the offline specs need the service worker, which only
// a production build serves (CLAUDE.md, "E2E needs a production server").
// Usage: node .factory/e2e-with-server.mjs <playwright test arguments...>   (used by suites.e2e.run in .factory/project.yaml)
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';

const require = createRequire(import.meta.url);
const isWindows = process.platform === 'win32';
const STARTUP_TIMEOUT_MS = 180_000;
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const exited = (child) => child.exitCode !== null || child.signalCode !== null;

function stopTree(child) {
  if (child.pid === undefined) return;
  try {
    if (isWindows) {
      if (!exited(child)) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else process.kill(-child.pid, 'SIGKILL'); // the server runs in its own process group; its children too
  } catch {
    /* already gone */
  }
}

async function waitUntilUp(url, server) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited(server)) throw new Error(`the server exited early (${server.signalCode ?? `code ${server.exitCode}`})`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual' }); // any HTTP answer means it is up
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`the server did not answer on ${url} within ${STARTUP_TIMEOUT_MS / 1000}s`);
}

// `next dev` and `next build` rewrite CLAUDE.md / AGENTS.md (Next.js agent rules). The tracked ones are restored from git at start and
// end, so the worktree stays clean; an untracked one that did not exist at start is removed.
const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md'];
const tracked = spawnSync('git', ['ls-files', '--', ...AGENT_FILES], { encoding: 'utf8' }).stdout?.split('\n').filter(Boolean) ?? [];
const absentAtStart = AGENT_FILES.filter((f) => !tracked.includes(f) && !fs.existsSync(f));
function restoreAgentFiles() {
  if (tracked.length > 0) spawnSync('git', ['checkout', '--', ...tracked], { stdio: 'ignore' });
  for (const f of absentAtStart) fs.rmSync(f, { force: true });
}
restoreAgentFiles();

const nextBin = require.resolve('next/dist/bin/next');
const build = spawnSync(process.execPath, [nextBin, 'build'], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
if (build.status !== 0) {
  restoreAgentFiles();
  console.error(`e2e: next build failed (${build.signal ?? `code ${build.status}`})`);
  process.exit(1);
}

// On Linux `next start` gets SIGTERM when this script dies, even by SIGKILL (setpriv --pdeathsig), and stops its own
// children; elsewhere only the process-group kill below stops it.
const nextArgs = [nextBin, 'start', '-p'];
const pdeathsig = process.platform === 'linux' && spawnSync('setpriv', ['--help'], { stdio: 'ignore' }).status === 0;
const port = await freePort();
const baseUrl = `http://localhost:${port}`;
const [cmd, args] = pdeathsig
  ? ['setpriv', ['--pdeathsig', 'TERM', '--', process.execPath, ...nextArgs, String(port)]]
  : [process.execPath, [...nextArgs, String(port)]];
const server = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], detached: !isWindows, windowsHide: true });
server.on('error', (err) => console.error(`e2e: server: ${err.message}`));

let stopping = false;
const cleanup = () => {
  if (stopping) return;
  stopping = true;
  stopTree(server);
  restoreAgentFiles();
};
process.on('exit', cleanup);

let pw = null;
for (const sig of SIGNALS) {
  process.on(sig, () => {
    // Playwright gets the signal and is waited for (it runs its teardown); the main flow then cleans up and exits.
    if (pw !== null && !exited(pw)) pw.kill(sig);
    else {
      cleanup();
      process.exit(130);
    }
  });
}

let code = 1;
try {
  await waitUntilUp(baseUrl, server);
  console.error(`e2e: production server up on ${baseUrl}`);
  code = await new Promise((resolve) => {
    pw = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: baseUrl },
    });
    pw.on('error', (err) => {
      console.error(`e2e: playwright: ${err.message}`);
      resolve(1);
    });
    pw.on('exit', (c, s) => resolve(c ?? (s ? 1 : 0)));
  });
} catch (err) {
  console.error(`e2e: ${err.message}`);
} finally {
  cleanup();
}
process.exit(code);
