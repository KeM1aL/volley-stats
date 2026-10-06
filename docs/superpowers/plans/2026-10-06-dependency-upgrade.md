# Dependency Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Next.js, the pnpm/Node toolchain and every dependency of VolleyStats to its latest stable version (or a recorded pin) without regressing core flows, in particular offline live match tracking.

**Architecture:** Ten ordered phases (Tasks 0–9) on branch `chore/deps-upgrade`, lowest risk first, plus a docs/hand-off task (Task 10). Every task ends with the same Phase Gate (typecheck, production build, full Playwright suite against a local production server, lint compared with a baseline) and exactly one commit. Behaviour that the existing e2e suite does not cover but the upgrades put at risk gets new e2e tests, written and run on the old version first, so each one fails only if the upgrade breaks the behaviour.

**Tech Stack:** pnpm 12.9.1, Node 24, Next.js 16.3.8 (Turbopack), React 19.3, Tailwind CSS 4.3, Serwist 9.5 (`@serwist/turbopack`), RxDB 17.6 (Dexie storage), Supabase, next-intl 4, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-10-06-dependency-upgrade-design.md`

## Global Constraints

- Work only in the worktree `C:\Development\GIT\volley-stats\.worktrees\chore-deps-upgrade` on branch `chore/deps-upgrade`. Never edit, stage or clean the main checkout at `C:\Development\GIT\volley-stats`.
- Never read `.env*` files (there is a `Read(.env*)` deny rule). Copy them with `cp` only.
- Package manager: pnpm `12.9.1` via the `packageManager` field. Node: `24` (`.nvmrc`), `engines.node: ">=24"`.
- One commit per phase, only when the Phase Gate is green. Stage explicit paths; never `git add -A`. Never commit `tests/fixtures/test-data.json` changes made by test runs (restore it with `git checkout -- tests/fixtures/test-data.json` before committing) or anything under `playwright/`, `test-results/`, `playwright-report/`.
- **Pin rule:** if a package's latest major cannot be adopted (incompatible peer dependency that breaks at runtime, missing tooling support, or a removed feature the app relies on), install the highest compatible version, add a row to the **Pinned packages** table at the end of the spec (package, pinned version, latest, reason) in the same commit, and continue. Do not rewrite features to accommodate an upgrade.
- **Dead-component rule:** if a `components/ui/*` file breaks under a new major and is imported nowhere (verify with the grep given in the task), delete it instead of porting it. If that leaves its library unused, remove the library and record it under "Removed packages" in the hand-off summary.
- Existing lint errors are recorded, not fixed. No unrelated refactors.
- Nothing is pushed or merged.

## Phase Gate

Run this at the end of every task. "Green" means all four checks pass.

1. **Typecheck:** `pnpm exec tsc --noEmit` exits 0.
2. **Build:** `pnpm build` exits 0.
3. **E2E:** start the production server in the background with `pnpm start -p 3100` (wait for "Ready"), then run
   `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`. Expected: all tests pass. The only allowed skips: `06z-screenshots` (unless `SCREENSHOT_LABEL` is set), `04b-rxdb-capture` (unless `CAPTURE_LEGACY_DB=1`) and `04c-rxdb-legacy` (until Task 8 has captured its state file). Stop the server afterwards. `BASE_URL` must be set explicitly: `playwright.config.ts` has no `webServer`, `.env.test.local` may point to a deployed site, and dotenv never overrides variables already set. `CI=1` runs headless and allows 1 retry.
4. **Lint:** `pnpm lint:report` then `node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json`. Expected: exit 0 ("No new lint errors"). Tasks 2 and 9 change the lint rule set and regenerate the baseline instead (instructions in those tasks).

After the gate: `git checkout -- tests/fixtures/test-data.json`, then commit.

## Review Focus

1. **Offline cold reload** — reloading the live match page while the device is still offline must render the match from the service-worker cache plus RxDB, not the browser's offline error page (the current suite only reloads after reconnecting). Test added in Task 3 (`04-live-offline.spec.ts`, step 5.5b).
2. **Reconnect mid-match** — going back online must not reload the live match page (Serwist's `SerwistProvider` reloads on `online` by default). Test added in Task 3 (`04-live-offline.spec.ts`, step 5.6).
3. **Logged-out visitors** — the public match stats page and the service-worker script must not be redirected to `/auth` by the proxy. Tests added in Task 2 (`06-match-stats.spec.ts`, logged-out describe) and Task 3 (`00-public-access.spec.ts`).
4. **Validation messages** — after zod 4, submitting an empty championship form must still show the translated "Gender is required" / "Age category is required" messages, not zod's generic defaults. Test added in Task 5 (`03-championships.spec.ts`, validation test).
5. **Device holding an RxDB v16 database** — after the RxDB 17 upgrade, a browser with v16 IndexedDB data must open the live match (fresh local DB, re-synced from Supabase), delete the old databases, and throw no RxDB error. Test added in Task 8 (`04c-rxdb-legacy.spec.ts`).

---

### Task 0: Baseline toolchain and green starting point

**Files:**
- Modify: `package.json` (packageManager, engines, `lint:report` script)
- Modify: `pnpm-workspace.yaml` (only if pnpm 12 reports ignored build scripts)
- Create: `.nvmrc`, `scripts/lint-summary.mjs`, `docs/superpowers/notes/lint-baseline.json`
- Delete: `package-lock.json`

**Interfaces:**
- Produces: `pnpm lint:report` (writes `test-results/lint.json`), `node scripts/lint-summary.mjs <report> [--baseline <file>] [--write <file>]`, `docs/superpowers/notes/lint-baseline.json` (object `{ "<ruleId>": <errorCount> }`). Every later task's Phase Gate uses these.

- [ ] **Step 1: Copy env files into the worktree (without reading them)**

```bash
cp ../../.env.local .env.local
cp ../../.env.test.local .env.test.local
ls -la .env.local .env.test.local
```
Expected: both files listed. Both are git-ignored.

- [ ] **Step 2: Update global npm (the user asked for latest npm)**

```bash
npm install -g npm@12.2.0
npm -v
```
Expected: `12.2.0`.

- [ ] **Step 3: Switch the project to pnpm 12.9.1, pin Node, drop the npm lockfile**

```bash
pnpm pkg set packageManager=pnpm@12.9.1
pnpm pkg set engines.node=">=24"
printf '24\n' > .nvmrc
git rm -q package-lock.json
pnpm -v
```
Expected: `pnpm -v` prints `12.9.1` (pnpm switches itself to the `packageManager` version). If it prints 10.x, run `npm install -g pnpm@12.9.1` and retry.

- [ ] **Step 4: Install**

```bash
pnpm install
```
Expected: completes. If the output lists "Ignored build scripts", run `pnpm approve-builds`, approve only `rxdb`, `supabase` and `esbuild`, and keep the resulting change in `pnpm-workspace.yaml`.

- [ ] **Step 5: Add the lint summary script**

Create `scripts/lint-summary.mjs`:

```js
#!/usr/bin/env node
// Summarise an ESLint JSON report as error counts per rule, optionally
// comparing against (or writing) a committed baseline.
// Usage: node scripts/lint-summary.mjs <report.json> [--baseline <file>] [--write <file>]
import fs from 'node:fs';

const [reportPath, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const counts = {};
for (const file of report) {
  for (const message of file.messages) {
    if (message.severity !== 2) continue;
    const rule = message.ruleId ?? '(fatal)';
    counts[rule] = (counts[rule] ?? 0) + 1;
  }
}
const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

const writePath = flag('--write');
if (writePath) {
  fs.writeFileSync(writePath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote baseline to ${writePath}`);
}

const baselinePath = flag('--baseline');
if (!baselinePath) {
  console.log(JSON.stringify(sorted, null, 2));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const regressions = Object.entries(sorted)
  .filter(([rule, count]) => count > (baseline[rule] ?? 0))
  .map(([rule, count]) => `${rule}: ${baseline[rule] ?? 0} -> ${count}`);

if (regressions.length) {
  console.error('New lint errors compared with baseline:\n  ' + regressions.join('\n  '));
  process.exit(1);
}
console.log('No new lint errors compared with baseline.');
```

- [ ] **Step 6: Add the `lint:report` script (Next 15 still uses `next lint`)**

```bash
pnpm pkg set scripts.lint:report="next lint --format json --output-file test-results/lint.json || exit 0"
mkdir -p test-results
pnpm lint:report
node scripts/lint-summary.mjs test-results/lint.json --write docs/superpowers/notes/lint-baseline.json
```
Expected: `Wrote baseline to docs/superpowers/notes/lint-baseline.json` and a JSON object of rule → count (may be `{}`). If `test-results/lint.json` is missing, `next lint` crashed: run `pnpm exec next lint` to see why and fix only the lint setup.

- [ ] **Step 7: Run typecheck and build on the current versions**

```bash
pnpm exec tsc --noEmit
pnpm build
```
Expected: both exit 0. If not, the baseline is red before any upgrade: stop and report to the user with the output; do not fix app code.

- [ ] **Step 8: Run the e2e suite on the current versions**

Start `pnpm start -p 3100` in the background, wait for "Ready", then:

```bash
CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e
```
Expected: all tests pass. If a test fails because of test infrastructure (selectors that drifted, timing), fix only files under `tests/`. If a failure is caused by app behaviour, stop and report it to the user. Stop the server.

- [ ] **Step 9: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .nvmrc scripts/lint-summary.mjs docs/superpowers/notes/lint-baseline.json tests/
git commit -m "chore: switch to pnpm 12, pin Node 24, record lint baseline"
```
(`git rm` already staged the `package-lock.json` deletion. Only include `tests/` if Step 8 changed test files.)

---

### Task 1: In-range minor and patch updates

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Update everything within the existing semver ranges**

```bash
pnpm update
pnpm outdated
```
Expected: `pnpm update` leaves every package at its "Wanted" version; `pnpm outdated` now lists only major-version updates (Current = Wanted < Latest). `next` should be `15.5.27`.

- [ ] **Step 2: Run the Phase Gate**

Expected: green. No code changes should be needed. If something breaks, find the package with `git diff pnpm-lock.yaml`, pin it to its previous exact version in `package.json`, and record it in the spec's Pinned packages table.

- [ ] **Step 3: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): apply in-range minor and patch updates"
```

---

### Task 2: Next.js 16 and React 19

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `next.config.js`
- Rename: `middleware.ts` → `proxy.ts`
- Create: `eslint.config.mjs`
- Delete: `.eslintrc.json`
- Modify: any `app/`, `components/`, `lib/`, `hooks/`, `contexts/` files that fail typecheck under React 19 types
- Modify: `docs/superpowers/notes/lint-baseline.json` (regenerated)
- Test: `tests/e2e/06-match-stats.spec.ts` (add logged-out test)

**Interfaces:**
- Produces: `pnpm lint` = `eslint .`; `pnpm lint:report` writes `test-results/lint.json` using the ESLint CLI. `proxy.ts` exports `proxy(req)` and `config`. Build and dev scripts temporarily use `--webpack` (Task 3 removes it).

- [ ] **Step 1: Write the logged-out stats test (Review Focus 3)**

Append to `tests/e2e/06-match-stats.spec.ts` (after the existing `test.describe` block; `loadFixture` is already defined in that file):

```ts
test.describe('Match Statistics — logged out', () => {
  // A visitor with no session cookies must still reach the public stats page.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('stats page is reachable without signing in', async ({ page }) => {
    const { completedMatchStatsUrl } = loadFixture();
    expect(
      completedMatchStatsUrl,
      'completedMatchStatsUrl not found in fixture — run 02-matches.spec.ts first'
    ).toBeTruthy();

    await page.goto(completedMatchStatsUrl!);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByRole('heading', { name: 'Match Statistics', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });
});
```

- [ ] **Step 2: Run the new test on Next 15 to confirm it describes current behaviour**

Build and start the server (`pnpm build`, then `pnpm start -p 3100` in the background), then run the whole suite (the test needs the fixture written by `02-matches`):

```bash
CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e
```
Expected: PASS, including "stats page is reachable without signing in". If it fails because the heading text differs for logged-out visitors, adjust the assertion to what the logged-out page actually shows (open it in the Playwright trace); do not change app code. Stop the server.

- [ ] **Step 3: Upgrade the framework packages**

```bash
pnpm add next@16.3.8 react@19.3.0 react-dom@19.3.0 @next/third-parties@16.3.8 eslint-config-next@16.3.8
pnpm add -D @types/react@19.3.0 @types/react-dom@^19 @types/node@^24.19.1
pnpm remove @next/swc-wasm-nodejs
```
`@types/node` deliberately tracks the Node runtime major (24), not the newest `@types/node`. Add a Pinned packages row to the spec: `@types/node | ^24.19.1 | <latest from npm view @types/node version> | matches the Node 24 runtime pinned in .nvmrc`.
Expected: installs with no unmet peer dependency errors for `react`. Peer warnings from libraries that list only React 18 are acceptable for now if the gate is green; list them in the commit message.

- [ ] **Step 4: Rename middleware to proxy**

```bash
git mv middleware.ts proxy.ts
```
In `proxy.ts`, rename the exported function only:

```ts
export async function proxy(req: NextRequest) {
```
Leave the body and `export const config` unchanged. `lib/supabase/middleware.ts` keeps its name (it is an internal helper, not the Next.js convention file).

- [ ] **Step 5: Remove the obsolete `eslint` option from `next.config.js`**

Replace the `nextConfig` object with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
};
```

- [ ] **Step 6: Switch linting to the ESLint CLI with a flat config**

```bash
git rm -q .eslintrc.json
```
Create `eslint.config.mjs`:

```js
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
```
Update the scripts (the `--webpack` flags keep `next-pwa` working until Task 3):

```bash
pnpm pkg set scripts.lint="eslint ."
pnpm pkg set scripts.lint:report="eslint . --format json --output-file test-results/lint.json || exit 0"
pnpm pkg set scripts.dev="next dev --webpack"
pnpm pkg set scripts.build="next build --webpack"
```

- [ ] **Step 7: Typecheck and fix React 19 / Next 16 type errors**

```bash
pnpm exec tsc --noEmit
```
Expected: type errors caused by the React 19 types. Fix each one with the smallest change that keeps behaviour:

| Error | Fix |
|---|---|
| `useRef<T>()` "Expected 1 arguments" | `useRef<T>(undefined)`, or `useRef<T \| null>(null)` for DOM refs |
| `Cannot find namespace 'JSX'` | `React.JSX.Element` (add `import type * as React from 'react'` if the file has no React import) |
| `ReactElement` props typed as `unknown` | `ReactElement<any>` or the precise props type |
| Ref callback returns a value (`ref={(el) => (x = el)}`) | use a block body: `ref={(el) => { x = el; }}` |
| `React.ElementRef` deprecation | leave as is (deprecation only) |

Re-run until it exits 0.

- [ ] **Step 8: Re-baseline lint for the new rule set**

```bash
pnpm lint:report
node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json || true
node scripts/lint-summary.mjs test-results/lint.json --write docs/superpowers/notes/lint-baseline.json
```
Expected: the first command lists the differences (new rules such as `react-hooks/*` from eslint-plugin-react-hooks 7). Copy that list into the commit message body; the second command records the new baseline. If a rule that existed in the old baseline went **up**, check whether code edited in Step 7 caused it. If it did, fix that code before re-baselining.

- [ ] **Step 9: Run the Phase Gate (steps 1–3; lint was handled in Step 8)**

Expected: green, including the logged-out stats test. Also check the auth setup still sets the locale through the proxy (`auth.setup.ts` visits `/en/`): it passes if all other tests find English text.

- [ ] **Step 10: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml next.config.js proxy.ts eslint.config.mjs docs/superpowers/notes/lint-baseline.json docs/superpowers/specs/2026-10-06-dependency-upgrade-design.md tests/e2e/06-match-stats.spec.ts app components lib hooks contexts
git commit -m "chore(deps): upgrade to Next.js 16 and React 19"
```
(The `middleware.ts` rename and `.eslintrc.json` deletion were already staged by `git mv` / `git rm`; listing deleted paths in `git add` aborts the command.)

---

### Task 3: Replace next-pwa with Serwist

**Files:**
- Create: `app/sw.ts`, `app/serwist/[path]/route.ts`, `components/providers/service-worker-provider.tsx`, `tests/e2e/00-public-access.spec.ts`, `tests/tools/sw-registrations.mjs`
- Modify: `next.config.js`, `app/layout.tsx`, `proxy.ts` (matcher), `tsconfig.json`, `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `tests/helpers/network.ts`, `tests/e2e/04-live-offline.spec.ts`

**Interfaces:**
- Consumes: `proxy.ts` `config.matcher` from Task 2.
- Produces: service worker served at `/serwist/sw.js` with scope `/`; `ServiceWorkerProvider` client component; `waitForServiceWorker(page)` in `tests/helpers/network.ts`.

- [ ] **Step 1: Capture the current service worker on a persistent browser profile (old next-pwa build)**

Create `tests/tools/sw-registrations.mjs`:

```js
// Prints the service worker registrations of a persistent Chromium profile,
// signed in with the cookies saved by tests/e2e/auth.setup.ts.
// Usage: node tests/tools/sw-registrations.mjs <baseUrl> <profileDir>
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const [baseUrl, profileDir] = process.argv.slice(2);
const { cookies } = JSON.parse(fs.readFileSync('playwright/.auth/user.json', 'utf8'));

const context = await chromium.launchPersistentContext(profileDir, { headless: true });
await context.addCookies(cookies);
const page = await context.newPage();
await page.goto(`${baseUrl}/en/matches`);
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.waitForTimeout(3000); // let a pending update install and activate

const registrations = await page.evaluate(async () =>
  (await navigator.serviceWorker.getRegistrations()).map((r) => ({
    scope: r.scope,
    active: r.active?.scriptURL ?? null,
    waiting: r.waiting?.scriptURL ?? null,
  }))
);
console.log(JSON.stringify(registrations, null, 2));
await context.close();
```
With the Task 2 build running (`pnpm build && pnpm start -p 3100`, and a recent e2e run so `playwright/.auth/user.json` exists):

```bash
node tests/tools/sw-registrations.mjs http://localhost:3100 playwright/sw-profile
```
Expected: one registration with `"active": "http://localhost:3100/sw.js"`. Keep `playwright/sw-profile` for Step 12. Stop the server.

- [ ] **Step 2: Write the offline tests (Review Focus 1 and 2) and the public-access test (Review Focus 3)**

Add to `tests/helpers/network.ts`:

```ts
/**
 * Wait until a service worker controls the page, so offline reloads are
 * served from its cache.
 */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 15_000,
  });
}
```

In `tests/e2e/04-live-offline.spec.ts`:
1. Change the network import to `import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';`
2. Add `await waitForServiceWorker(page);` immediately before `// 5.4 Go offline`.
3. Replace the block from `// 5.6 Reconnect` up to (not including) `// 5.7 Reload` with:

```ts
    // 5.5b Reload while still offline — the page shell must come from the
    // service worker cache and the match state from RxDB.
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const offlineLiveOrSetup = page
      .getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first());
    await expect(offlineLiveOrSetup).toBeVisible({ timeout: 20_000 });

    // 5.6 Reconnect — must not reload the page in the middle of a match.
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
    });
    await goOnline(page);
    await page.waitForTimeout(2_000);
    expect(
      await page.evaluate(
        () => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true
      ),
      'page reloaded when the connection came back'
    ).toBe(true);

```

Create `tests/e2e/00-public-access.spec.ts`:

```ts
/**
 * Public access — resources that must work without a session.
 */
import { test, expect } from '@playwright/test';

test.describe('Public access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('service worker script is served to logged-out visitors', async ({ request }) => {
    const response = await request.get('/serwist/sw.js', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
  });
});
```

- [ ] **Step 3: Run the new tests on the old build to see them fail**

`pnpm build && pnpm start -p 3100` (background), then:

```bash
CI=1 BASE_URL=http://localhost:3100 pnpm exec playwright test tests/e2e/00-public-access.spec.ts
```
Expected: FAIL (`/serwist/sw.js` does not exist yet: 307 redirect to `/auth` or 404). The 5.5b step in `04-live-offline` may already pass with next-pwa; that is fine, because it guards the migration. Stop the server.

- [ ] **Step 4: Swap the packages**

```bash
pnpm remove next-pwa
pnpm add @serwist/turbopack@9.5.13 serwist@9.5.13
pnpm add -D esbuild@0.28.2
```
`@serwist/turbopack` uses native `esbuild` on Windows. If `pnpm install` reports esbuild's build script as ignored, add `esbuild` to `onlyBuiltDependencies` in `pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - esbuild
  - rxdb
  - supabase
```

- [ ] **Step 5: Write the service worker**

Create `app/sw.ts`:

```ts
import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Same behaviour as the previous next-pwa setup (skipWaiting + clientsClaim,
// Workbox-style default runtime caching). cleanupOutdatedCaches removes the
// precache left behind by next-pwa on devices that had it installed.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

Create `app/serwist/[path]/route.ts`:

```ts
import { createSerwistRoute } from '@serwist/turbopack';

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
});
```

- [ ] **Step 6: Register it from the layout**

Create `components/providers/service-worker-provider.tsx`:

```tsx
'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';

// Registers /serwist/sw.js (scope "/"). Disabled in development like the
// previous next-pwa setup. reloadOnOnline is off: a reload on reconnect would
// interrupt live match tracking.
export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === 'development'}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
```

In `app/layout.tsx`, add `import { ServiceWorkerProvider } from '@/components/providers/service-worker-provider';` and wrap the `NextIntlClientProvider` element in `<body>`:

```tsx
      <body>
        <ServiceWorkerProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            {/* …existing children unchanged… */}
          </NextIntlClientProvider>
        </ServiceWorkerProvider>
      </body>
```

- [ ] **Step 7: Wire Serwist into the Next config and remove next-pwa**

Replace `next.config.js` with:

```js
const { withSerwist } = require('@serwist/turbopack');
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
};

module.exports = withSerwist(withNextIntl(nextConfig));
```
If `require('@serwist/turbopack')` fails because the package is ESM-only (`ERR_REQUIRE_ESM`), rename the file with `git mv next.config.js next.config.mjs` and use `import { withSerwist } from '@serwist/turbopack'`, `import createNextIntlPlugin from 'next-intl/plugin'`, `const withNextIntl = createNextIntlPlugin('./i18n.ts')` and `export default withSerwist(withNextIntl(nextConfig))`.

Drop the `--webpack` flags:

```bash
pnpm pkg set scripts.dev="next dev"
pnpm pkg set scripts.build="next build"
```

- [ ] **Step 8: Keep the service worker out of the auth redirect**

In `proxy.ts`, add `serwist` to the excluded paths of the matcher:

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|serwist|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",],
};
```

- [ ] **Step 9: Type the worker file and ignore generated output**

In `tsconfig.json`, add `"webworker"` to `compilerOptions.lib`:

```json
"lib": ["dom", "dom.iterable", "esnext", "webworker"],
```
In `.gitignore`, replace the "Auto Generated PWA files" block with:

```
# Auto Generated PWA files (legacy next-pwa output)
**/public/sw.js
**/public/workbox-*.js
**/public/swe-worker-*.js
```

- [ ] **Step 10: Typecheck and build**

```bash
pnpm exec tsc --noEmit
pnpm build
```
Expected: both exit 0. The build log shows Serwist's "precache entries" line when `/serwist/sw.js` is prerendered. If `tsc` reports conflicts between `dom` and `webworker` lib types in `app/sw.ts`, exclude the worker from the main project (`"exclude": ["node_modules", "supabase", "app/sw.ts"]`) and add `/// <reference lib="webworker" />` as the first line of `app/sw.ts` instead of the tsconfig `lib` change.

- [ ] **Step 11: Run the Phase Gate**

Expected: green, including `00-public-access` and the 5.5b/5.6 steps of `04-live-offline`.

- [ ] **Step 12: Check that devices with the old next-pwa worker switch over**

With the new build running on port 3100:

```bash
node tests/tools/sw-registrations.mjs http://localhost:3100 playwright/sw-profile
```
Expected: exactly one registration, scope `http://localhost:3100/`, `"active": "http://localhost:3100/serwist/sw.js"`, `"waiting": null`. If `/sw.js` is still active, run the command a second time (the browser checks for updates on navigation). If it still has not switched, stop and report. Stop the server.

- [ ] **Step 13: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add -u
git add app/sw.ts app/serwist components/providers/service-worker-provider.tsx tests/e2e/00-public-access.spec.ts tests/tools/sw-registrations.mjs
git status --short
git commit -m "feat(pwa): replace next-pwa with Serwist for Turbopack builds"
```
(`git add -u` stages every modified tracked file, including `next.config.js` or its `git mv` rename to `.mjs`. `app/serwist` is added as a directory because `[path]` would be read as a glob. Before committing, check `git status --short` shows nothing staged under `tests/fixtures/`, `playwright/` or `test-results/`.)

---

### Task 4: Tailwind CSS 4

**Files:**
- Create: `tests/e2e/06z-screenshots.spec.ts`
- Modify: `app/globals.css`, `postcss.config.js` (→ `postcss.config.mjs` if the tool converts it), `components.json`, `package.json`, `pnpm-lock.yaml`, class names across `app/` and `components/` (by the upgrade tool)
- Delete: `tailwind.config.ts`

**Interfaces:**
- Produces: `SCREENSHOT_LABEL=<label>` environment variable that turns on the screenshot spec, writing PNGs to `playwright/screens/<label>/`. Task 6 reuses it.

- [ ] **Step 1: Add the screenshot spec**

Create `tests/e2e/06z-screenshots.spec.ts` (sorts after `06-match-stats` and before `07-team-detail-cleanup`, so fixture data still exists):

```ts
/**
 * Before/after screenshots for visual upgrades (Tailwind, UI libraries).
 * Skipped unless SCREENSHOT_LABEL is set. Output: playwright/screens/<label>/
 */
import { test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LABEL = process.env.SCREENSHOT_LABEL;
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const OUT_DIR = path.join(__dirname, '../../playwright/screens', LABEL ?? 'unused');

function loadFixture(): Record<string, string | undefined> {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

async function shoot(page: Page, name: string) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_500); // let data and animations settle
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

test.describe('Screenshots', () => {
  test.skip(!LABEL, 'Set SCREENSHOT_LABEL to capture screenshots');

  for (const theme of ['light', 'dark'] as const) {
    test(`main screens (${theme})`, async ({ page }) => {
      test.setTimeout(3 * 60_000);
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      const fixture = loadFixture();

      const pages: [string, string | undefined][] = [
        ['home', '/'],
        ['teams', '/teams'],
        ['team-detail', fixture.teamId ? `/teams/${fixture.teamId}` : undefined],
        ['matches', '/matches'],
        ['match-stats', fixture.completedMatchStatsUrl],
        ['live-match', fixture.offlineMatchId ? `/matches/${fixture.offlineMatchId}/live` : undefined],
        ['championships', '/championships'],
        ['settings', '/settings'],
      ];
      for (const [name, url] of pages) {
        if (!url) continue;
        await page.goto(url);
        await shoot(page, `${theme}-${name}`);
      }

      // Date range picker popover (react-day-picker) on the matches page.
      await page.goto('/matches');
      const dateButton = page.locator('#date').first();
      if (await dateButton.isVisible().catch(() => false)) {
        await dateButton.click();
        await shoot(page, `${theme}-date-picker`);
      }
    });
  }
});
```
Check the fixture keys used above against `tests/fixtures/test-data.json` and the specs that write it (`grep -n "saveFixture" tests/e2e/*.ts`). If the team id is stored under another key, use that key. If the date picker lives behind a "Filters" toggle (see `tests/helpers/match-setup.ts` step 2), click that toggle first.

- [ ] **Step 2: Capture "before" screenshots on Tailwind 3**

`pnpm build && pnpm start -p 3100` (background), then:

```bash
SCREENSHOT_LABEL=tw3 CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e
```
Expected: all pass; PNGs in `playwright/screens/tw3/`. Stop the server.

- [ ] **Step 3: Run the official upgrade tool**

The tool requires a clean working tree. Commit the screenshot spec first on its own (it is a test-only change):

```bash
git checkout -- tests/fixtures/test-data.json
git add tests/e2e/06z-screenshots.spec.ts
git commit -m "test(e2e): add opt-in before/after screenshot spec"
pnpm dlx @tailwindcss/upgrade@4.3.3
```
Expected: it updates `package.json` (tailwindcss 4, `@tailwindcss/postcss`), rewrites `app/globals.css` to `@import "tailwindcss";` with an `@theme` block and `@custom-variant dark (&:is(.dark *));`, migrates `tailwind.config.ts` into CSS (and deletes it), updates the PostCSS config, and renames changed utilities in templates (e.g. `shadow-sm` → `shadow-xs`, `rounded` → `rounded-sm`, `outline-none` → `outline-hidden`). Review `git diff --stat`.

- [ ] **Step 4: Replace the animation plugin and autoprefixer**

```bash
pnpm remove tailwindcss-animate autoprefixer
pnpm add tw-animate-css@1.4.0 tailwind-merge@3.7.0
```
In `app/globals.css`, replace `@plugin "tailwindcss-animate";` (if the tool added it) with `@import "tw-animate-css";` placed right after `@import "tailwindcss";`. Keep `@import "flag-icons/css/flag-icons.min.css";` as the first line.
The PostCSS config must contain only:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```
(in `postcss.config.mjs`; if the tool kept `postcss.config.js`, use `module.exports = { plugins: { '@tailwindcss/postcss': {} } };` there).

- [ ] **Step 5: Point shadcn's config at the CSS-first setup**

In `components.json`, set `"config": ""` inside `"tailwind"` (Tailwind 4 has no JS config file).

- [ ] **Step 6: Check that the JS config is gone and the build passes**

```bash
ls tailwind.config.ts 2>/dev/null && echo "STILL PRESENT"
grep -n "@config" app/globals.css
pnpm exec tsc --noEmit && pnpm build
```
Expected: no "STILL PRESENT", no `@config` line, build exits 0. If the tool left `tailwind.config.ts` behind with an `@config` reference, move its remaining `theme.extend` values into the `@theme` block by hand (colours as `--color-<name>: hsl(var(--<name>));`, radii as `--radius-lg: var(--radius);` etc.) and delete the file.

- [ ] **Step 7: Capture "after" screenshots and compare**

Run the Phase Gate's E2E step with `SCREENSHOT_LABEL=tw4`. Open each pair `playwright/screens/tw3/<name>.png` / `tw4/<name>.png` with the Read tool and compare them. Look for missing borders (Tailwind 4 changed the default border colour to `currentColor`; `* { @apply border-border; }` in `globals.css` should still cover it), changed ring widths (`ring` is now 1px), dark mode not applying, broken animations on dialogs/accordions, and different spacing. Fix differences in `app/globals.css` or the affected class names. List every remaining intentional difference in the commit message.

- [ ] **Step 8: Run the Phase Gate**

Expected: green.

- [ ] **Step 9: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add -u
git status --short
```
`git add -u` stages the tool's edits and deletions to tracked files. If `git status --short` shows a new untracked `postcss.config.mjs` (`??`), stage it with `git add postcss.config.mjs`. Make sure nothing under `tests/fixtures/`, `playwright/` or `test-results/` is staged, then:

```bash
git commit -m "chore(deps): migrate to Tailwind CSS 4"
```

---

### Task 5: zod 4 and @hookform/resolvers 5

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `components/championships/new-championship-dialog.tsx:76-81`, `components/match-formats/match-format-form.tsx:34-50`, `components/matches/new-match-form.tsx:49`, `components/players/player-form.tsx` (coerce field), plus any file `tsc` flags
- Test: `tests/e2e/03-championships.spec.ts`

- [ ] **Step 1: Write the validation-message test (Review Focus 4)**

Append inside the existing `test.describe('Championships — CRUD', …)` block in `tests/e2e/03-championships.spec.ts`:

```ts
  test('empty form shows translated required-field messages', async ({ page }) => {
    await page.goto('/championships');
    await expect(page.getByRole('heading', { name: 'Championships', level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: 'New Championship' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5_000 });

    await dialog.getByRole('button', { name: 'Create Championship' }).click();

    await expect(dialog.getByText('Gender is required')).toBeVisible();
    await expect(dialog.getByText('Age category is required')).toBeVisible();
    await expect(dialog.getByText(/^Invalid (input|option)/)).toHaveCount(0);
  });
```

- [ ] **Step 2: Run it on zod 3 to confirm it passes today**

Build, start on 3100, run the full suite. Expected: PASS. Stop the server.

- [ ] **Step 3: Upgrade**

```bash
pnpm add zod@4.6.5 @hookform/resolvers@5.9.1
pnpm exec tsc --noEmit
```
Expected: type errors in forms.

- [ ] **Step 4: Replace removed zod 3 parameters**

`required_error` / `invalid_type_error` no longer exist; zod 4 uses `error`:

```ts
// components/championships/new-championship-dialog.tsx
    gender: z.enum(["female", "male", "mixte"], {
      error: t('validation.genderRequired'),
    }),
    age_category: z.enum(["U10", "U12", "U14", "U16", "U18", "U21", "senior"], {
      error: t('validation.ageCategoryRequired'),
    }),
```

```ts
// components/matches/new-match-form.tsx
    date: z.date({ error: t('validation.dateRequired') }),
```

In `components/match-formats/match-format-form.tsx`, change the `required_error: "Please select a volleyball format"` entry to `error: "Please select a volleyball format"`.

- [ ] **Step 5: Fix form types where input and output differ**

With `@hookform/resolvers` 5, schemas whose input type differs from their output type (`z.coerce.*`, `.default()`) need both types on `useForm`. In `components/match-formats/match-format-form.tsx` and `components/players/player-form.tsx`, change the `useForm` call to:

```ts
const form = useForm<z.input<typeof formSchema>, unknown, z.output<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  // …existing options unchanged
});
```
(use the schema variable name the file already has). The submit handler keeps receiving `z.output<typeof formSchema>` (same as the old `z.infer`). If a field component then complains that its value is `unknown` (a coerced number input), pass `value={field.value as number | string | undefined ?? ''}`; do not change the schema.

Re-run `pnpm exec tsc --noEmit` and fix the remaining errors with the same two patterns. `z.string().email(msg)` still works in zod 4 (deprecated in favour of `z.email()`); leave it.

- [ ] **Step 6: Run the Phase Gate**

Expected: green, including "empty form shows translated required-field messages" and the form-heavy specs (`01-teams` player form, `02-matches` new-match form, `05-settings` password form).

- [ ] **Step 7: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml components app tests/e2e/03-championships.spec.ts
git commit -m "chore(deps): upgrade to zod 4 and @hookform/resolvers 5"
```

---

### Task 6: UI libraries

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `components/ui/calendar.tsx` (full rewrite), `components/matches/new-match-form.tsx:163`, `components/ui/date-picker-with-range.tsx` (`initialFocus`)
- Delete (dead-component rule, after verification): `components/ui/chart.tsx`, `components/ui/resizable.tsx`, `components/ui/sonner.tsx`
- Modify: recharts call sites if `tsc` flags them: `components/matches/stats/*.tsx`, `components/matches/history/statistics-dialog.tsx`, `app/matches/[id]/stats/page.tsx`

- [ ] **Step 1: Capture "before" screenshots**

Build, start on 3100, then `SCREENSHOT_LABEL=ui-before CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`. Stop the server.

- [ ] **Step 2: Verify the three shadcn wrappers are unused**

```bash
grep -rnE "components/ui/(chart|resizable|sonner)['\"]|from ['\"](sonner|react-resizable-panels)['\"]" app components hooks contexts lib | grep -vE "^components/ui/(chart|resizable|sonner)\.tsx"
```
Expected: no output. (The app's toasts use the Radix `components/ui/toaster.tsx`; charts import `recharts` directly.) If there is output, the file is used: port it instead of deleting it, using the library's types as reported by `tsc`.

- [ ] **Step 3: Delete the dead wrappers and their now-unused libraries**

```bash
git rm -q components/ui/chart.tsx components/ui/resizable.tsx components/ui/sonner.tsx
pnpm remove sonner react-resizable-panels
```

- [ ] **Step 4: Upgrade the remaining UI libraries**

```bash
pnpm add lucide-react@1.52.0 react-day-picker@10.0.2 recharts@3.10.1 framer-motion@14.0.0 react-dropzone@20.1.2
pnpm exec tsc --noEmit
```
Expected: errors in `components/ui/calendar.tsx` (v8 class names and `IconLeft`/`IconRight` are gone) and wherever `initialFocus` is passed.

- [ ] **Step 5: Rewrite the calendar for react-day-picker 10**

Replace `components/ui/calendar.tsx` with:

```tsx
"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-4",
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        week: "mt-2 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal"
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground [&>button]:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_start: "rounded-l-md bg-accent",
        range_end: "rounded-r-md bg-accent",
        range_middle:
          "bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className={cn("h-4 w-4", className)} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
```
Replace the `initialFocus` prop with `autoFocus` in `components/matches/new-match-form.tsx` and `components/ui/date-picker-with-range.tsx`.

- [ ] **Step 6: Fix remaining type errors**

```bash
pnpm exec tsc --noEmit
```
- lucide-react 1.x: if an icon import no longer exists, import its current name (the error message names the missing export; lucide's renamed icons keep the old name as a deprecated alias in most cases, e.g. `BarChart3` → `ChartColumn`, `AlertCircle` → `CircleAlert`, `CheckCircle2` → `CircleCheck`, `HelpCircle` → `CircleHelp`, `MoreHorizontal` → `Ellipsis`, `Loader2` → `LoaderCircle`).
- recharts 3: custom `content`/`formatter` callbacks may need their parameter types updated to the types recharts now exports (follow the error message); do not change chart data.
- framer-motion / react-dropzone: follow the error messages; behaviour must not change.

Re-run until it exits 0.

- [ ] **Step 7: Capture "after" screenshots and compare**

Run the Phase Gate's E2E step with `SCREENSHOT_LABEL=ui-after`. Compare each pair in `playwright/screens/ui-before/` and `ui-after/` with the Read tool, focusing on `*-date-picker.png` (calendar layout, selected range colouring, chevrons), `*-match-stats.png` (charts, tooltips, legends), and icons everywhere. Fix calendar class names until the date picker matches the "before" image in structure (exact pixel match is not required). List remaining intentional differences in the commit message.

- [ ] **Step 8: Run the Phase Gate**

Expected: green.

- [ ] **Step 9: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml components app
git commit -m "chore(deps): upgrade UI libraries (lucide 1, react-day-picker 10, recharts 3, framer-motion 14, react-dropzone 20)

Removed unused shadcn wrappers chart.tsx, resizable.tsx, sonner.tsx and the
now-unused sonner and react-resizable-panels packages."
```

---

### Task 7: Utility libraries

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`; files `tsc` flags among `lib/importers/ffvb.ts`, `lib/pdf/*`, `lib/supabase/types.ts`, `scripts/deploy-email-templates.ts`, `playwright.config.ts`, and the `date-fns` call sites (`app/matches/page.tsx`, `components/matches/live/**`, `components/matches/new-match-form.tsx`, `components/ui/date-picker-with-range.tsx`)

- [ ] **Step 1: Upgrade**

```bash
pnpm add date-fns@4.4.0 uuid@14.0.2 jspdf@4.2.1 type-fest@5.10.0
pnpm add -D dotenv@18.0.5 react-email@6.11.0 @react-email/components@1.0.12
pnpm outdated
```
Expected: the `pnpm outdated` list now contains only packages handled by Tasks 8–9 (`rxdb`, `eslint`, `typescript`) plus anything already pinned. If `@types/uuid` is listed and uuid 14 ships its own types (`ls node_modules/uuid/dist/*.d.ts` or `dist/types`), run `pnpm remove @types/uuid`.

- [ ] **Step 2: Typecheck and fix**

```bash
pnpm exec tsc --noEmit
```
- date-fns 4: imports of the form `import { format } from 'date-fns'` and `import { fr } from 'date-fns/locale'` are unchanged. Fix only what `tsc` reports.
- type-fest 5 needs TypeScript ≥ 5.9 (already true). Fix renamed helpers reported by `tsc` in `lib/supabase/types.ts`.
- dotenv 18 may log an "injecting env" line on every `config()` call in `playwright.config.ts`. If that clutters the test output, pass `{ path: …, quiet: true }` in each of the four `config()` calls.

- [ ] **Step 3: Check the PDF export by hand**

jsPDF is only covered by "Export PDF button is in the DOM" in `06-match-stats`. With the server running, open a completed match's stats page at a desktop width (≥ 1280 px) using Playwright (`mcp__plugin_playwright_playwright__browser_navigate` or `npx playwright open`), click "Export PDF", and confirm a PDF downloads and opens with content. Report the result in the commit message.

- [ ] **Step 4: Run the Phase Gate**

Expected: green.

- [ ] **Step 5: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml lib app components scripts playwright.config.ts
git commit -m "chore(deps): upgrade date-fns 4, uuid 14, jspdf 4, type-fest 5, dotenv 18, react-email 6"
```

---

### Task 8: RxDB 17

**Files:**
- Modify: `lib/rxdb/database.ts` (database name + legacy cleanup), `package.json`, `pnpm-lock.yaml`, other `lib/rxdb/**` / hook files `tsc` flags
- Create: `tests/e2e/04b-rxdb-capture.spec.ts`, `tests/e2e/04c-rxdb-legacy.spec.ts`

**Interfaces:**
- Consumes: `offlineMatchId` written to `tests/fixtures/test-data.json` by `04-live-offline.spec.ts`.
- Produces: local database name `volleystats_db_v17` (plus the existing `?database=` suffix); `deleteLegacyDatabases()` runs before the database is created.

Design note: RxDB major versions do not share an on-disk format, and the existing reset fallback in `getDatabase()` only runs in development or with `?remove-database=true`. The agreed recovery is wipe-and-resync, so the database name gets a generation suffix: v17 always starts from an empty local database, and any IndexedDB left by v16 is deleted. Unsynced v16 data is lost by design (only the owner and testers use the app).

- [ ] **Step 1: Write the capture spec (runs only on RxDB 16)**

Create `tests/e2e/04b-rxdb-capture.spec.ts`:

```ts
/**
 * Captures the browser's IndexedDB (RxDB v16 databases) after opening a live
 * match, for 04c-rxdb-legacy.spec.ts. Runs only with CAPTURE_LEGACY_DB=1.
 * Output (git-ignored): playwright/.auth/rxdb-legacy-state.json
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const OUT = path.join(__dirname, '../../playwright/.auth/rxdb-legacy-state.json');

test('capture legacy RxDB IndexedDB state', async ({ page }) => {
  test.skip(!process.env.CAPTURE_LEGACY_DB, 'Set CAPTURE_LEGACY_DB=1 on RxDB 16 to capture');

  const { offlineMatchId } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  expect(offlineMatchId, 'run 04-live-offline.spec.ts first').toBeTruthy();

  await page.goto(`/matches/${offlineMatchId}/live`);
  await expect(
    page.getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first())
  ).toBeVisible({ timeout: 30_000 });

  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name ?? '')
  );
  expect(names.some((n) => n.includes('volleystats_db'))).toBe(true);

  await page.context().storageState({ path: OUT, indexedDB: true });
});
```

- [ ] **Step 2: Write the legacy-database test (Review Focus 5)**

Create `tests/e2e/04c-rxdb-legacy.spec.ts`:

```ts
/**
 * A browser that still holds RxDB v16 IndexedDB data must open the live match
 * on RxDB 17: legacy databases are deleted, a fresh local database is synced
 * from Supabase, and no RxDB error is thrown.
 * Needs playwright/.auth/rxdb-legacy-state.json from 04b-rxdb-capture.spec.ts.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const LEGACY_STATE = path.join(__dirname, '../../playwright/.auth/rxdb-legacy-state.json');
const CURRENT_STATE = path.join(__dirname, '../../playwright/.auth/user.json');

test('live match opens on a device with RxDB v16 data', async ({ browser }) => {
  test.skip(!fs.existsSync(LEGACY_STATE), 'No legacy capture — run 04b with CAPTURE_LEGACY_DB=1 on RxDB 16');

  // Fresh session cookies from this run's auth setup + the captured v16 IndexedDB.
  const current = JSON.parse(fs.readFileSync(CURRENT_STATE, 'utf-8'));
  const legacy = JSON.parse(fs.readFileSync(LEGACY_STATE, 'utf-8'));
  const context = await browser.newContext({
    storageState: { cookies: current.cookies, origins: legacy.origins },
  });
  const page = await context.newPage();

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // Read the restored databases from a non-app document on the same origin:
  // any app page would run getDatabase() and delete the legacy databases first.
  await page.goto('/manifest.webmanifest');
  const before = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name ?? '')
  );
  expect(
    before.some((n) => n.includes('volleystats_db') && !n.includes('volleystats_db_v17')),
    'captured state should contain v16 databases'
  ).toBe(true);

  const { offlineMatchId } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  await page.goto(`/matches/${offlineMatchId}/live`);
  await expect(
    page.getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first())
  ).toBeVisible({ timeout: 30_000 });

  const after = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? ''));
  expect(after.filter((n) => n.includes('volleystats_db') && !n.includes('volleystats_db_v17'))).toEqual([]);
  expect(pageErrors.filter((m) => /RxError|RxDB/i.test(m))).toEqual([]);

  await context.close();
});
```
Note: the restored storage state only applies to the origin it was captured on, so capture and test must both use `BASE_URL=http://localhost:3100`.

- [ ] **Step 3: Capture on RxDB 16 and confirm the new test fails**

Build, start on 3100, then:

```bash
CAPTURE_LEGACY_DB=1 CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e
```
Expected: `04b` passes and writes `playwright/.auth/rxdb-legacy-state.json`. `04c` FAILS at the final `after` assertion (v16 code keeps using `volleystats_db`, so non-`_v17` databases remain). Stop the server.

- [ ] **Step 4: Upgrade RxDB**

```bash
pnpm add rxdb@17.6.0
pnpm install
pnpm exec tsc --noEmit
```
Fix any type errors in `lib/rxdb/**` and the hooks that use RxDB by following the error messages. Plugin import paths used by the app (`rxdb/plugins/storage-dexie`, `storage-memory`, `validate-ajv`, `local-documents`, `query-builder`, `update`, `dev-mode`, `replication`, `leader-election`) all still exist in v17.

- [ ] **Step 5: Version the local database name and delete legacy databases**

In `lib/rxdb/database.ts`, add below `let dbPromise …`:

```ts
// RxDB major versions do not share an on-disk format. Bump DB_GENERATION when
// upgrading RxDB's major version: databases from older generations are deleted
// and the live match re-syncs from Supabase (syncMatch).
const DB_BASE_NAME = 'volleystats_db';
const DB_GENERATION = 'v17';
const DB_CURRENT_NAME = `${DB_BASE_NAME}_${DB_GENERATION}`;

async function deleteLegacyDatabases(): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
  const legacyNames = (await indexedDB.databases())
    .map((info) => info.name)
    .filter(
      (name): name is string =>
        !!name && name.includes(DB_BASE_NAME) && !name.includes(DB_CURRENT_NAME)
    );
  await Promise.all(
    legacyNames.map(
      (name) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = request.onerror = request.onblocked = () => resolve();
        })
    )
  );
}
```
In `getDatabaseName()`, change `let ret = 'volleystats_db';` to `let ret = DB_CURRENT_NAME;` (move the constants above `getDatabaseName` if needed so they are defined first). In `getDatabase()`, right after `await devModePluginPromise;`, add:

```ts
  try {
    await deleteLegacyDatabases();
  } catch (error) {
    console.warn('Could not delete legacy local databases:', error);
  }
```
Update the stale comment above `getDatabaseName()` ("the database name is 'heroesdb'") to say `volleystats_db_v17`.

- [ ] **Step 6: Run the legacy test**

Build, start on 3100, then run the full suite (04c needs the fixture from 04):

```bash
CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e
```
Expected: all pass, including `04c` ("live match opens on a device with RxDB v16 data"); `04b` is skipped.

- [ ] **Step 7: Run the Phase Gate**

Expected: green (the run from Step 6 counts for the E2E step if nothing changed since).

- [ ] **Step 8: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml lib hooks components tests/e2e/04b-rxdb-capture.spec.ts tests/e2e/04c-rxdb-legacy.spec.ts
git commit -m "chore(deps): upgrade to RxDB 17 with a fresh, versioned local database"
```

---

### Task 9: ESLint 10 and TypeScript 7

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `docs/superpowers/notes/lint-baseline.json`, `docs/superpowers/specs/2026-10-06-dependency-upgrade-design.md` (Pinned packages)

Known before starting (checked 2026-10-06): `eslint-config-next@16.3.8` depends on `eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y`, whose peer ranges stop at ESLint 9; `typescript-eslint` (used by `eslint-config-next`) supports TypeScript `>=4.8.4 <6.1.0`; the `typescript@7.0.2` package exposes no classic compiler API (`main` is `lib/version.cjs`). Expect both pins below; the steps confirm it.

- [ ] **Step 1: Try ESLint 10**

```bash
pnpm add eslint@10.12.0
pnpm lint:report
node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json
```
Adopt ESLint 10 only if `pnpm exec eslint .` runs without a crash (no "TypeError", "context.… is not a function", or plugin load error) and the comparison prints "No new lint errors". Otherwise:

```bash
pnpm add eslint@9.39.5
```
and add a Pinned packages row: `eslint | 9.39.5 | 10.12.0 | eslint-config-next 16.3.8 plugins (react, import, jsx-a11y) do not support ESLint 10` (adjust the reason to the actual failure).

- [ ] **Step 2: Try TypeScript 7**

```bash
pnpm add typescript@7.0.2
pnpm exec tsc --noEmit
pnpm build
pnpm lint:report
```
Adopt TypeScript 7 only if all three succeed (the build's type-check step and the lint run must not crash). Otherwise:

```bash
pnpm add typescript@6.0.3
pnpm exec tsc --noEmit
```
Expected: exits 0 (TypeScript 6 may report new errors from changed defaults; fix them like Task 2 Step 7). If TypeScript 6 also breaks the build or `typescript-eslint`, use the latest 5.9.x instead. Add a Pinned packages row with the version used and the reason (e.g. `typescript | 6.0.3 | 7.0.2 | Next.js build type-check and typescript-eslint need the classic compiler API, which TypeScript 7 does not ship; typescript-eslint supports <6.1.0`).

- [ ] **Step 3: Re-baseline lint if the rule set changed**

If ESLint or TypeScript changed version, regenerate the baseline exactly as in Task 2 Step 8 and list the differences in the commit message.

- [ ] **Step 4: Run the Phase Gate**

Expected: green.

- [ ] **Step 5: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add package.json pnpm-lock.yaml docs/superpowers/notes/lint-baseline.json docs/superpowers/specs/2026-10-06-dependency-upgrade-design.md app components lib hooks contexts
git commit -m "chore(deps): upgrade lint and TypeScript tooling"
```

---

### Task 10: Docs and hand-off

**Files:**
- Modify: `CLAUDE.md`, `.claude/docs/*.md` (wherever they mention versions, `next-pwa`, `middleware.ts`, `npm run`), `docs/superpowers/specs/2026-10-06-dependency-upgrade-design.md` (Pinned packages complete)

- [ ] **Step 1: Find stale references**

```bash
grep -rnE "Next\.js 1[45]|React 18|next-pwa|middleware\.ts|Tailwind( CSS)? 3|tailwind\.config|RxDB 1[56]|zod 3|npm run|npm install" CLAUDE.md .claude/docs README.md
```

- [ ] **Step 2: Update them**

- `CLAUDE.md` line 5: `**Tech Stack**: Next.js 16 + React 19 + TypeScript + Supabase + RxDB 17 (offline live match) + Tailwind CSS 4`.
- `CLAUDE.md` "Common Commands": use `pnpm dev`, `pnpm build`, `pnpm start`, and add `pnpm lint` and `pnpm test:e2e` (`CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e` against `pnpm start -p 3100`).
- `CLAUDE.md` PWA bullet: "PWA with Serwist service worker (`app/sw.ts`, served at `/serwist/sw.js`)".
- `.claude/docs/*`: replace `middleware.ts` with `proxy.ts`, `next-pwa` with Serwist, version numbers with the new ones, and `npm run` with `pnpm`. Mention the `DB_GENERATION` rule in `.claude/docs/04-offline-sync.md`: bumping RxDB's major version means bumping `DB_GENERATION` in `lib/rxdb/database.ts`.

- [ ] **Step 3: Final verification on a clean install**

```bash
rm -rf node_modules .next
pnpm install --frozen-lockfile
pnpm outdated
```
Then run the full Phase Gate. Expected: green; `pnpm outdated` lists only packages in the Pinned packages table.

- [ ] **Step 4: Commit**

```bash
git checkout -- tests/fixtures/test-data.json
git add CLAUDE.md .claude/docs README.md docs/superpowers/specs/2026-10-06-dependency-upgrade-design.md
git commit -m "docs: update stack and commands after dependency upgrade"
```

- [ ] **Step 5: Hand-off summary to the user**

Report: the commit list (`git log --oneline main..HEAD`), the final versions of the main packages, the Pinned packages table, removed packages (`next-pwa`, `@next/swc-wasm-nodejs`, `tailwindcss-animate`, `autoprefixer`, `sonner`, `react-resizable-panels`, plus anything else), the intentional visual differences from Tasks 4 and 6, the PDF check result, and the reminder that `feature/voice-stats` must be rebased onto the upgraded `main`. Do not push or merge.
