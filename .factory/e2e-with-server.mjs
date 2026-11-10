#!/usr/bin/env node
// Runs the Playwright e2e suite against its own dev server: picks a free port, starts `next dev`, waits until it answers,
// runs `playwright test <args>` with BASE_URL pointing at it, then stops the whole server process tree.
// Usage: node .factory/e2e-with-server.mjs <playwright test arguments...>   (used by suites.e2e.run in .factory/project.yaml)
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';

const require = createRequire(import.meta.url);
const isWindows = process.platform === 'win32';
const STARTUP_TIMEOUT_MS = 180_000;

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

function stopTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  try {
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGKILL'); // the server runs in its own process group
  } catch {
    /* already gone */
  }
}

async function waitUntilUp(url, server) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`the dev server exited early (code ${server.exitCode})`);
    try {
      await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual' }); // any HTTP answer means it is up
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`the dev server did not answer on ${url} within ${STARTUP_TIMEOUT_MS / 1000}s`);
}

// `next dev` rewrites CLAUDE.md / AGENTS.md (Next.js agent rules): put them back so the worktree stays clean.
const agentFiles = ['CLAUDE.md', 'AGENTS.md'].map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]);
function restoreAgentFiles() {
  for (const [f, content] of agentFiles) {
    if (content === null) fs.rmSync(f, { force: true });
    else if (!fs.readFileSync(f).equals(content)) fs.writeFileSync(f, content);
  }
}

const port = await freePort();
const baseUrl = `http://localhost:${port}`;
const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-p', String(port)], {
  stdio: ['ignore', 'inherit', 'inherit'],
  detached: !isWindows,
  windowsHide: true,
});
let stopping = false;
const cleanup = () => { if (stopping) return; stopping = true; stopTree(server); restoreAgentFiles(); };
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });

let code = 1;
try {
  await waitUntilUp(baseUrl, server);
  console.error(`e2e: dev server up on ${baseUrl}`);
  const pw = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, BASE_URL: baseUrl },
  });
  code = await new Promise((resolve) => pw.on('exit', (c, s) => resolve(c ?? (s ? 1 : 0))));
} catch (err) {
  console.error(`e2e: ${err.message}`);
} finally {
  cleanup();
}
process.exit(code);
