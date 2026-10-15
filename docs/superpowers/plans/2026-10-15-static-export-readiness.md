# Static-Export Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app builds as a static export (`BUILD_TARGET=mobile`, `output: 'export'`) for the future Capacitor shell while the Vercel web build keeps working, with a faster and more reliable test suite, CI, and in-app account deletion.

**Architecture:** One codebase, two build targets selected by `BUILD_TARGET` in `next.config.js`. Server-only Next files carry a `.web.ts` suffix that only the web target's `pageExtensions` recognises; `lib/platform/` is the one module that differs per target, through a `@platform-impl` alias. Dynamic routes become query-param routes, auth and locale move to the client, auth emails use `token_hash` links, and account deletion is a Postgres RPC.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19, TypeScript 6, next-intl 4, Supabase (`@supabase/ssr`, `supabase-js`), RxDB 17, Serwist, Vitest 5, Playwright, GitHub Actions, pnpm 12, Node 24.

**Spec:** [docs/superpowers/specs/2026-10-14-static-export-readiness-design.md](../specs/2026-10-14-static-export-readiness-design.md) (parent: [mobile app decision record](../specs/2026-10-09-mobile-app-decision.md)). Read both before starting.

## Global Constraints

- Branch: `feature/static-export`. Commit after every task; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never write secret values (service-role key, passwords, JWTs, `sb_secret_…`) into code, docs, plans, commits or test output. Name env variables only. `SUPABASE_SERVICE_ROLE_KEY` is read only in `lib/server/` and in e2e helpers; never under a `NEXT_PUBLIC_` name.
- The Supabase project is shared with production. Apply a migration only after the user says yes (Task 12). Use the Supabase MCP tools (`execute_sql`, `apply_migration`); if they report that authentication is needed, stop and ask the user to authorize the Supabase MCP server (`/mcp`) or to run the SQL in the dashboard SQL editor and paste the result.
- Every new UI string exists in `messages/en`, `fr`, `es`, `it`, `pt` with the same keys (`tests/unit/i18n/locale-parity.test.ts` enforces it; `pnpm i18n:check` too).
- Live match writes stay in RxDB (`useLocalDb`); no API-layer calls from the live page.
- Unit tests: `pnpm test` (Vitest, `tests/unit/**/*.test.ts`, node environment: test pure modules, not React components).
- E2E (Windows machine): stop any `next dev` first. `pnpm build && pnpm start -p 3100` in the background, then `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e <args>`. Before restarting the server, free port 3100: `netstat -ano | grep ":3100 " | grep LISTEN` then `taskkill //PID <pid> //F //T`. Rebuild after every source change. During a task run only the projects/specs the change touches (after Task 2: `--project=<name>` or `pnpm test:e2e:quick`); run the full suite in Task 14.
- Until Task 2 removes it, a run rewrites `tests/fixtures/test-data.json`: restore it with `git checkout -- tests/fixtures/test-data.json`.
- Lint: the repo has 42 pre-existing errors (baseline `docs/superpowers/notes/lint-baseline.json`). Gate: `node scripts/lint-report.mjs && node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json` must print "No new lint errors compared with baseline."
- Typecheck: `npx tsc --noEmit` must not gain errors (compare with the count before your task if it isn't zero).
- Web behaviour that must not change: existing web sessions (cookie) survive; `/matches/<id>/stats` links keep working (redirect); the PWA service worker keeps working on web.

## Review Focus

1. **An old URL with extra query params** (`/matches/<id>/live?team=<teamId>`) must land on `/matches/live?id=<id>&team=<teamId>`, and `/teams/new` must not be swallowed by the `/teams/:id` redirect. Pinned by `tests/e2e/09-routes.spec.ts` (Task 6).
2. **A route opened without `id`, or with a non-UUID id** (`/matches/live`, `/teams/view?id=abc`) shows the not-found page, never a crash or an endless loader. Pinned by `parseRouteId` unit tests and the e2e step in `09-routes.spec.ts` (Task 6).
3. **A signed-out visitor following a deep link** (`/teams/players?id=…`) is sent to `/auth` and returned to the exact page with its query after signing in; an unsafe `redirectTo` (`//evil.com`, `https://evil.com`, `/auth`) falls back to `/`. Pinned by `isSafeRedirectTarget` unit tests (Task 6) and `10-auth-guard.spec.ts` (Task 7).
4. **A user who picked a language on this device and then signs in** keeps that language if they chose it explicitly (`?lang=` or the switcher) — the profile is adopted only once per user per device and never over an explicit choice. Pinned by `profileLocaleToAdopt` unit tests (Task 9).
5. **Deleting an account while live-match changes are unsent, or as the only owner of a club** deletes nothing and says why. Pinned by the RPC verification SQL (Task 12) and `13-account-deletion.spec.ts` (Task 13).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tests/unit/helpers/wait.ts` | `holdsFor` (a condition stays true for a window) | 1 |
| `tests/unit/sync/manager-*.test.ts` (4 files) | `manager.test.ts` split by concern | 1 |
| `tests/helpers/fixture.ts` | Read/write `playwright/.data/fixture.json` | 2 |
| `tests/helpers/seed.ts`, `tests/e2e/seed.setup.ts` | API seed: team, 8 players, archived Player 9 | 2 |
| `tests/helpers/match-setup.ts`, `tests/helpers/live.ts` | Match by API + start dialog; `scorePoints` | 2 |
| `playwright.config.ts`, `package.json` | Projects, levels, timeouts | 2 |
| `tests/e2e/*.spec.ts` | No silent steps, no fixed waits, new fixture | 3 |
| `next.config.js` | Build targets, redirects, aliases | 4, 6, 9 |
| `proxy.web.ts`, `app/**/route.web.ts` | Server-only files (web target) | 4, 7, 9 |
| `lib/platform/{types.ts,index.ts,web/*,mobile/*,shared/*}` | Platform seam | 5 |
| `lib/api-client.ts` | `apiFetch` with Bearer token and API origin | 5 |
| `lib/server/{supabase.ts,session.ts,report-caller.ts,cors.ts}` | Server-only helpers | 5, 10 |
| `scripts/build-mobile.mjs` | Runs `next build` with `BUILD_TARGET=mobile` on any OS | 4 |
| `eslint.config.mjs` | Import boundaries | 5 |
| `lib/routes.ts`, `hooks/use-route-id.ts` | Route builders, public paths, id parsing | 6 |
| `app/matches/{live,score,stats}/`, `app/teams/{view,players}/`, `app/championships/view/` | Query-param pages | 6 |
| `components/auth/auth-guard.tsx` | Client auth guard | 7 |
| `app/auth/confirm/page.tsx`, `supabase/functions/send-email/_confirm-url.ts` | `token_hash` links | 8 |
| `lib/i18n/{resolve-locale.ts,locale-path.ts}`, `components/providers/locale-provider.tsx`, `hooks/use-app-locale.ts` | Client locale | 9 |
| `scripts/lib/export-check.mjs`, `scripts/check-export.mjs`, `scripts/serve-export.mjs` | Export check + static server | 10 |
| `supabase/migrations/20261015000000_account_deletion.sql` | FKs + `delete_my_account()` | 12 |
| `components/settings/delete-account-card.tsx` | Deletion UI | 13 |
| `.github/workflows/ci.yml`, `CLAUDE.md`, `.claude/docs/*` | CI and docs | 14 |

---

## Phase A — Test suite revision (spec §8)

### Task 1: Unit tests: split the sync manager tests, no wall-clock assertions

**Files:**
- Modify: `tests/unit/helpers/wait.ts`
- Create: `tests/unit/sync/manager-helpers.ts`, `tests/unit/sync/manager-lifecycle.test.ts`, `tests/unit/sync/manager-accounts.test.ts`, `tests/unit/sync/manager-upgrade.test.ts`, `tests/unit/sync/manager-lost-matches.test.ts`
- Delete: `tests/unit/sync/manager.test.ts`
- Modify: `tests/unit/sync/replication.test.ts`, `tests/unit/sync/scorer-claim-flow.test.ts`, `tests/unit/sync/match-sync.test.ts`

**Interfaces:**
- Produces: `holdsFor(check, windowMs, message): Promise<void>` in `tests/unit/helpers/wait.ts`; `setupManagerSuite()` in `manager-helpers.ts` returning `{ server(), matchId(), device(options?) }`.

- [ ] **Step 1: Measure the baseline**

Run: `pnpm vitest run --reporter=json --outputFile=test-results/unit-before.json` then
`node -e "const r=require('./test-results/unit-before.json');for(const t of r.testResults.map(t=>[t.endTime-t.startTime,t.name]).sort((a,b)=>b[0]-a[0]).slice(0,5))console.log(Math.round(t[0]/1000)+'s',t[1])"`
Expected: `manager.test.ts` around 43 s at the top. Note the total wall time printed by `pnpm test`.

- [ ] **Step 2: Add `holdsFor`**

Append to `tests/unit/helpers/wait.ts`:

```ts
/**
 * Proves something does NOT happen: `check` must stay true for the whole window. Fails as soon as it
 * turns false, naming what changed. Use instead of `sleep(ms); expect(...)`.
 */
export async function holdsFor(
  check: () => boolean | Promise<boolean>,
  windowMs: number,
  message: string
): Promise<void> {
  const deadline = Date.now() + windowMs;
  do {
    if (!(await check())) throw new Error(`Expected ${message} to hold for ${windowMs} ms`);
    await sleep(20);
  } while (Date.now() < deadline);
}
```

- [ ] **Step 3: Extract the shared suite setup**

Create `tests/unit/sync/manager-helpers.ts` with the `beforeEach`/`afterEach`, `device()` factory and the local helper functions that `manager.test.ts` defines inside `describe("SyncManager")` (everything between line 23 and the first `it(`, plus helpers such as `leaveLostMatch`, `leaveOldLocalMatch`, `daysAgo`, `alignmentFailed`, `serverPoints` wherever they are defined in the file). Shape:

```ts
import { afterEach, beforeEach } from "vitest";
import type { SyncManagerOptions } from "@/lib/rxdb/sync/manager";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import { seedServerMatch, seedTeams } from "../helpers/fixtures";
import { TestDevice } from "../helpers/test-device";

/** Registers the per-test fake server, seeded match and device cleanup; call once at the top of a describe. */
export function setupManagerSuite() {
  let server: FakeSupabaseServer;
  let matchId: string;
  const devices: TestDevice[] = [];
  beforeEach(() => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
  });
  afterEach(async () => {
    await Promise.all(devices.splice(0).map((d) => d.dispose()));
  });
  return {
    server: () => server,
    matchId: () => matchId,
    async device(options: { deviceId?: string; userName?: string; syncOptions?: Partial<SyncManagerOptions> } = {}) {
      const created = await TestDevice.create(server, options);
      devices.push(created);
      return created;
    },
  };
}
```

Move the other helpers (`leaveLostMatch`, `daysAgo`, …) into this file as exported functions taking `server`/`device` as parameters instead of closing over them.

- [ ] **Step 4: Split the tests into four files, unchanged except for the helper calls**

Each file starts with `const suite = setupManagerSuite();` inside its `describe`, and reads `suite.server()` / `suite.matchId()` where the old tests read `server` / `matchId`. Assign the `it(...)` blocks by title (line numbers from the current file):

| File | Tests (current lines) |
|---|---|
| `manager-lifecycle.test.ts` | 45, 59, 72, 104, 138, 152, 168, 180, 195, 307, 325, 346, 363, 383, 763–891 (the remaining top-level ones from "resolves a match opened before sign-in" to "asks the platform to keep local data") |
| `manager-accounts.test.ts` | 213, 230, 245, 263, 277, 292 |
| `manager-upgrade.test.ts` | 397, 422, 461, 472, 502, 518, 536, 549, 563 |
| `manager-lost-matches.test.ts` | the `describe("a lost match nobody takes back")` block (572–762) |

Delete `tests/unit/sync/manager.test.ts`.

- [ ] **Step 5: Replace "nothing happens" sleeps with `holdsFor`**

In the new files and in the other sync tests, rewrite each `await sleep(N); expect(X)...` where the expectation says something did not happen:

| Site (old file:line) | New code |
|---|---|
| manager 222 | `await holdsFor(() => serverPoints().length === 0, 300, "no point uploaded while signed out");` then keep the `pending.count` expectation |
| manager 240 | `await holdsFor(() => serverPoints().length === 0, 300, "no upload for another account");` |
| manager 258 | `await holdsFor(() => !d.manager.isTracking(matchId) && serverPoints().length === 0, 300, "the match stays untracked and unsent");` |
| manager 438 | `await holdsFor(async () => (await d.manager.tracked.entry(matchId))?.claim !== "lost", 500, "the seeded match is not marked lost");` |
| manager 467 | `await holdsFor(async () => (await d.manager.tracked.entry(deletedMatchId)) === null && server.row("matches", deletedMatchId) === undefined, 200, "the deleted match stays deleted");` |
| manager 779 | `await holdsFor(() => !d.manager.isTracking(matchId), 100, "nothing tracked after destroy");` |
| manager 816 | `await holdsFor(() => d.manager.isTracking(matchId), 50, "tracked while cancelling");` |
| manager 876 | `await holdsFor(async () => (await d.db.sets.findOne(set.id).exec()) === null, 100, "no pull without a refresh");` |
| replication 209, 222, 279, 307, 355, 376, 418 | same pattern: the `expect` that follows becomes the `holdsFor` check (keep the comment at 355) |
| scorer-claim-flow 224, 279 | same pattern |
| match-sync 142 | same pattern |

Leave `sleep(30)` at manager 161 (it paces connection toggles), the `sleep(5)` calls in `match-commands.test.ts` (they make timestamps differ) and the mocked delay in scorer-claim-flow 111.

- [ ] **Step 6: Remove the wall-clock assertion from the flaky test**

In `manager-lost-matches.test.ts`, the test "does not make anything wait for a server that never answers it…" asserts `expect(Date.now() - started).toBeLessThan(500)` with `pruneAlignTimeoutMs: 600`; under load the machine is slower than 500 ms. Replace it with an ordering check:

```ts
const d = await suite.device({ syncOptions: { pruneAlignTimeoutMs: 1500 } });
// ...
await d.signIn();
expect(await d.manager.syncMatch(otherMatchId, 5000)).toBe(true);
// The other match opened while the alignment was still waiting on the hung server:
expect(alignmentFailed(warn)).toBe(false);
```

Delete the `started` variable. Keep the rest of the test.

- [ ] **Step 7: Run the unit tests, idle and under load**

Run: `pnpm test` — Expected: all pass; note the wall time.
Then start a load (`pnpm build && pnpm start -p 3100` in the background) and run `pnpm test` twice more. Expected: all pass both times; wall time under 15 s on the idle run. If the idle wall time is still over 15 s, list the five slowest files (Step 1 command) in the task report instead of guessing further changes. Stop the server and free port 3100.

- [ ] **Step 8: Commit**

```bash
git add tests/unit
git commit -m "test(sync): split the manager tests, prove absences with holdsFor, no wall-clock assertion"
```

### Task 2: E2E infrastructure: API seed, explicit projects, quick level

**Files:**
- Create: `tests/helpers/fixture.ts`, `tests/helpers/seed.ts`, `tests/e2e/seed.setup.ts`, `tests/helpers/live.ts`
- Modify: `tests/helpers/match-setup.ts`, `tests/helpers/server-data.ts`, `playwright.config.ts`, `package.json`, `components/matches/match-table.tsx` (or wherever `data-testid="start-match-trigger"` is rendered: `grep -rn 'start-match-trigger' components`)
- Delete: `tests/fixtures/test-data.json`

**Interfaces:**
- Produces:
  - `readFixture(): E2eFixture`, `updateFixture(patch: Partial<E2eFixture>): void` with
    `interface E2eFixture { runId: string; teamId: string; teamName: string; playerNames: string[]; archivedPlayerName: string; completedMatchId?: string; championshipId?: string; offlineMatchId?: string }`
  - `seedTeam(runId): Promise<Pick<E2eFixture,'teamId'|'teamName'|'playerNames'|'archivedPlayerName'>>`
  - `createMatchByApi(teamId: string): Promise<string>` (match id)
  - `createAndStartMatch(page, { teamId, teamName, excludePlayers?, absentPlayers? }): Promise<{ matchId: string; selectedPlayers: number }>`
  - `scorePoints(page, count): Promise<void>` in `tests/helpers/live.ts`
  - Playwright projects: `setup`, `seed`, `core`, `live`, `finished-match`, `stats`, `tools` (only with `E2E_TOOLS=1`)
  - Scripts: `test:e2e` (all but tools), `test:e2e:quick` (`core` + `live`)

- [ ] **Step 1: Fixture helper**

Create `tests/helpers/fixture.ts`:

```ts
import fs from 'fs';
import path from 'path';

/** Written by the seed project for this run; git-ignored (playwright/ is in .gitignore). */
export const FIXTURE_PATH = path.join(__dirname, '../../playwright/.data/fixture.json');

export interface E2eFixture {
  runId: string;
  teamId: string;
  teamName: string;
  /** Eight active players, Player 1 … Player 8, with volleyball positions. */
  playerNames: string[];
  /** A ninth member, archived: never offered for a new match. */
  archivedPlayerName: string;
  /** Set by finished-match (02-matches). */
  completedMatchId?: string;
  /** Set by 03-championships. */
  championshipId?: string;
  offlineMatchId?: string;
}

export function readFixture(): E2eFixture {
  if (!fs.existsSync(FIXTURE_PATH)) throw new Error('No e2e fixture: run through the "seed" project (any project but setup depends on it)');
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

export function writeFixture(fixture: E2eFixture): void {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
}

export function updateFixture(patch: Partial<E2eFixture>): void {
  writeFixture({ ...readFixture(), ...patch });
}
```

- [ ] **Step 2: Seed helper (test user, RLS applies)**

Create `tests/helpers/seed.ts`:

```ts
import { serverClient } from './server-data';

const PLAYERS = [
  { name: 'Player 1', number: 1, position: 'setter' },
  { name: 'Player 2', number: 2, position: 'outside_hitter' },
  { name: 'Player 3', number: 3, position: 'middle_hitter' },
  { name: 'Player 4', number: 4, position: 'opposite' },
  { name: 'Player 5', number: 5, position: 'outside_hitter' },
  { name: 'Player 6', number: 6, position: 'middle_hitter' },
  { name: 'Player 7', number: 7, position: 'outside_hitter' },
  { name: 'Player 8', number: 8, position: 'setter' },
];
export const ARCHIVED_PLAYER = 'Player 9';

async function must<T>(label: string, request: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`seed ${label}: ${error.message}`);
  return data;
}

/** The run's team as the e2e account: 8 active players and one archived (names match the UI specs). */
export async function seedTeam(runId: string) {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const teamId = crypto.randomUUID();
  const teamName = `E2E Team ${runId}`;
  await must('team', supabase.from('teams').insert({
    id: teamId, name: teamName, status: 'active', user_id: user!.id,
    championship_id: null, club_id: null, created_at: now, updated_at: now, ext_code: null, ext_source: null,
  }));
  await must('players', supabase.from('team_members').insert([
    ...PLAYERS.map((p) => ({ team_id: teamId, name: p.name, number: p.number, position: p.position, role: 'player' })),
    { team_id: teamId, name: ARCHIVED_PLAYER, number: 9, position: null, role: 'player', archived_at: now },
  ]));
  return { teamId, teamName, playerNames: PLAYERS.map((p) => p.name), archivedPlayerName: ARCHIVED_PLAYER };
}

/** An upcoming match of the run's team against the shared "Team 1", format "Test (6x6)" (5 points per set). */
export async function createMatchByApi(teamId: string): Promise<string> {
  const supabase = await serverClient();
  const [away] = await must('away team', supabase.from('teams').select('id').eq('name', 'Team 1').eq('_deleted', false).limit(1));
  const [format] = await must('format', supabase.from('match_formats').select('id').eq('description', 'Test').eq('format', '6x6').limit(1));
  if (!away || !format) throw new Error('seed: the shared "Team 1" team or the "Test (6x6)" format is missing');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await must('match', supabase.from('matches').insert({
    id, home_team_id: teamId, away_team_id: (away as { id: string }).id, date: now,
    match_format_id: (format as { id: string }).id, championship_id: null, season_id: null, location: null,
    status: 'upcoming', home_score: 0, away_score: 0, created_at: now, updated_at: now,
  }));
  return id;
}
```

If the `teams` insert succeeds but the creator does not get an owner `team_members` row (the UI relies on a database trigger), Step 6 will show it: the start dialog then has no managed-team radio. In that case add `{ team_id: teamId, name: 'E2E Owner', number: 0, role: 'owner', user_id: user!.id }` to the players insert and re-run.

- [ ] **Step 3: Seed setup project**

Create `tests/e2e/seed.setup.ts`:

```ts
import { test as setup } from '@playwright/test';
import { writeFixture } from '../helpers/fixture';
import { seedTeam } from '../helpers/seed';

setup('seed the run team', async () => {
  const runId = String(Date.now());
  writeFixture({ runId, ...(await seedTeam(runId)) });
});
```

- [ ] **Step 4: Start trigger carries the match id**

Find the start trigger: `grep -rn 'start-match-trigger' components`. On every element with `data-testid="start-match-trigger"` add `data-match-id={match.id}` (use the variable the surrounding code uses for the row's match).

- [ ] **Step 5: `createAndStartMatch` via the API, `scorePoints`**

Rewrite `tests/helpers/match-setup.ts`:

```ts
import { expect, Page } from '@playwright/test';
import { createMatchByApi } from './seed';

export interface CreateAndStartMatchOptions {
  teamId: string;
  teamName: string;
  /** Players left unticked in the start dialog (e.g. a player who arrives late). */
  excludePlayers?: string[];
  /** Players the start dialog must not offer (archived). */
  absentPlayers?: string[];
}

export interface CreateAndStartMatchResult {
  matchId: string;
  /** How many players were ticked: the roster size. */
  selectedPlayers: number;
}

/** Creates an upcoming match by API, starts it through the start dialog, and waits for the live page. */
export async function createAndStartMatch(page: Page, options: CreateAndStartMatchOptions): Promise<CreateAndStartMatchResult> {
  const { teamId, teamName, excludePlayers = [], absentPlayers = [] } = options;
  const matchId = await createMatchByApi(teamId);

  await page.goto('/matches');
  await expect(page.getByRole('heading', { name: 'Matches', level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Filters' }).click();
  // Combobox order on the matches page: 0=Championship, 1=Club, 2=Team
  await page.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();

  // Two triggers per match (mobile card + desktop table); at 768 px the desktop one is visible.
  await page.locator(`[data-testid="start-match-trigger"][data-match-id="${matchId}"]`).last().click();
  const dialog = page.getByRole('dialog', { name: 'Start Match' });
  await expect(dialog).toBeVisible();

  // Managed team: the home team (first radio). The radio input is sr-only under a styled div.
  await dialog.getByRole('radio').first().click({ force: true });
  const toggles = dialog.getByTestId('lineup-player-toggle');
  await expect(toggles.first()).toBeVisible({ timeout: 10_000 });
  for (const name of absentPlayers) {
    await expect(dialog.locator(`[data-testid="lineup-player-toggle"][data-player-name="${name}"]`)).toHaveCount(0);
  }
  let selectedPlayers = 0;
  for (const toggle of await toggles.all()) {
    if (excludePlayers.includes((await toggle.getAttribute('data-player-name')) ?? '')) continue;
    await toggle.click();
    selectedPlayers++;
    await expect(dialog.getByTestId('lineup-selected-count')).toHaveText(new RegExp(`^${selectedPlayers} selected`));
  }

  await dialog.getByTestId('start-match-confirm').click();
  await page.waitForURL((url) => url.searchParams.get('id') === matchId || url.pathname.includes(`/matches/${matchId}/live`), { timeout: 15_000 });
  return { matchId, selectedPlayers };
}
```

(The `url.pathname.includes(...)` branch keeps the helper working before Task 6 changes the routes; Task 6 removes it.)

Create `tests/helpers/live.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** Scores `count` points for the managed team, waiting for each to show on the scoreboard. */
export async function scorePoints(page: Page, count: number): Promise<void> {
  const button = page.getByTestId('point-btn-managed-point').first();
  const score = page.getByTestId('live-score');
  for (let i = 0; i < count; i++) {
    const before = Number(await score.getAttribute('data-home'));
    await button.click();
    await expect(score).toHaveAttribute('data-home', String(before + 1));
  }
}
```

- [ ] **Step 6: Playwright projects and levels**

Replace the `timeout`, `projects` and add `testIgnore` in `playwright.config.ts` (keep the dotenv lines, `globalTeardown`, `fullyParallel`, `forbidOnly`, `retries`, `workers`, `reporter`, `use`):

```ts
const chrome = {
  ...devices['Desktop Chrome'],
  storageState: 'playwright/.auth/user.json',
  // Portrait tablet viewport — forces the portrait StatTracker layout and the desktop sidebar
  viewport: { width: 768, height: 1024 },
  headless: !!process.env.CI,
};
const TOOLS = ['**/04b-rxdb-capture.spec.ts', '**/04c-rxdb-legacy.spec.ts', '**/06z-screenshots.spec.ts'];
const LIVE = ['**/04-live-offline.spec.ts', '**/04d-*.spec.ts', '**/04e-*.spec.ts', '**/04f-*.spec.ts', '**/04g-*.spec.ts', '**/04h-*.spec.ts'];
const FINISHED = ['**/02-matches.spec.ts'];
const STATS = ['**/06-match-stats.spec.ts', '**/06b-*.spec.ts'];
```

```ts
  // Most tests finish in under 30 s; the full match and the two-device test set their own limit.
  timeout: 90_000,
  // Web-only specs are tagged @web and skipped for the static export.
  grepInvert: process.env.E2E_TARGET === 'mobile' ? /@web/ : undefined,
  projects: [
    { name: 'setup', testMatch: '**/auth.setup.ts' },
    { name: 'seed', testMatch: '**/seed.setup.ts', dependencies: ['setup'] },
    { name: 'core', use: chrome, dependencies: ['seed'], testIgnore: [...TOOLS, ...LIVE, ...FINISHED, ...STATS, '**/*.setup.ts'] },
    { name: 'live', use: chrome, dependencies: ['seed'], testMatch: LIVE },
    { name: 'finished-match', use: chrome, dependencies: ['seed'], testMatch: FINISHED },
    { name: 'stats', use: chrome, dependencies: ['finished-match'], testMatch: STATS },
    ...(process.env.E2E_TOOLS ? [{ name: 'tools', use: chrome, dependencies: ['finished-match'], testMatch: TOOLS }] : []),
  ],
```

In `package.json` scripts, keep `test:e2e` and add:

```json
"test:e2e:quick": "playwright test --project=core --project=live",
```

Delete the tracked fixture: `git rm tests/fixtures/test-data.json`.

- [ ] **Step 7: Move every reader of the old fixture to `readFixture()`**

In each spec and helper, replace the local `loadFixture`/`saveFixture`/`FIXTURE_PATH` code with `import { readFixture, updateFixture } from '../helpers/fixture';` and pass `{ teamId, teamName }` to `createAndStartMatch` (instead of `{ teamName, playerNames }`). Replacements:
- `completedMatchStatsUrl` → `completedMatchId` (02 writes `updateFixture({ completedMatchId: matchId })`; readers build the URL with `` `/matches/${completedMatchId}/stats?team=${teamId}` `` for now — Task 6 switches them to `routes.matchStats`).
- `archivedPlayerName` comes from the seed; `01b` no longer writes it.
- `03-championships` writes `updateFixture({ championshipId })`.
- `04-live-offline` writes `updateFixture({ offlineMatchId: matchId })` and stops writing `offlineMatchLiveUrl` (unused: `grep -rn offlineMatchLiveUrl tests` must show nothing else).
- Move the "leaves a finished match without asking" test (`04g-leave-live-match.spec.ts:109–129`) to a new `tests/e2e/06b-leave-finished-match.spec.ts` (stats project), reading `completedMatchId`.

- [ ] **Step 8: Run each project**

Build and start the server (Global Constraints), then:
Run: `CI=1 BASE_URL=http://localhost:3100 npx playwright test --project=core --project=live`
Expected: all pass. Then: `CI=1 BASE_URL=http://localhost:3100 npx playwright test --project=stats` — Expected: pulls in `finished-match`; all pass. Note both durations.

- [ ] **Step 9: Commit**

```bash
git add tests playwright.config.ts package.json components
git commit -m "test(e2e): seed the run team by API, explicit Playwright projects, quick level"
```

### Task 3: E2E specs: no silent steps, no fixed waits, smaller teams spec

**Files:**
- Modify: every file listed in the table below; `tests/helpers/court.ts`, `tests/helpers/network.ts`
- Modify: `CLAUDE.md` (Common Commands)

**Interfaces:**
- Consumes: `readFixture`, `createAndStartMatch`, `scorePoints` (Task 2).

- [ ] **Step 1: Rules for each change**

Apply these rules everywhere below:
1. `if (await x.isVisible().catch(() => false)) { act }` → when the step is part of what the test proves, `await expect(x).toBeVisible(); act`; when the branch handles UI that is never there any more, delete the branch.
2. `await page.waitForTimeout(n)` after a click → wait for the state the click produces (`await expect(locator).toHaveAttribute/toBeVisible/toHaveText(...)`).
3. `await page.waitForTimeout(600)` after typing in the team search box → `await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible()`.
4. Point loops → `await scorePoints(page, n)`.

- [ ] **Step 2: Apply per file**

| File: lines | Change |
|---|---|
| `01-teams.spec.ts` | Becomes one short test: create `E2E Team <Date.now()> UI`, rename it, add **one** player (Player 1, setter), assert it is listed. Remove the fixture writing and the 8-player loop. Search helper: rule 3. Lines 102 (`waitForTimeout(500)` after save) → `await expect(page.getByText('Team updated').first()).toBeVisible()` already precedes it: delete the wait. |
| `01b-player-archive.spec.ts:24,29` | Use `readFixture()`; open the players page with `page.goto('/teams/' + teamId + '/players')` (Task 6 changes the URL). Archive/restore a new **Player 10** created in the test (not Player 9, which the seed archives). Rule 3 for the search; delete `openPlayersPage`'s search when using `goto`. |
| `02-matches.spec.ts` | Keep the new-match dialog flow in this spec only: before `createAndStartMatch`, create one match through the "New Match" dialog (copy the dialog steps from the old helper, lines 61–99 of the old `match-setup.ts`) and assert "Match created"; then play the full match with `createAndStartMatch` (API match). Phase A stat cards (51–59): assert each card is visible (rule 1). Substitution (63–91): rule 2 — after submit, `await expect(page.getByRole('dialog')).toHaveCount(0)`. Point loop (141–171): replace `isMatchComplete`/`pointBtnVisible` polling with: `while (!(await statsButton.isVisible()) && !(await setSetup.isVisible())) await scorePoints(page, 1);` — and after the loop decide set/match end from which one is visible. Save `updateFixture({ completedMatchId: matchId })`. |
| `03-championships.spec.ts:50,53` | Type "Regional", then `await expect(page.getByRole('option', { name: /regional/i }).first()).toBeVisible()` and click it (the CreatableSelect always offers either the existing value or "Create Regional"). Delete the branch. |
| `03b-dialog-keyboard.spec.ts:19` | Replace the 400 ms wait by polling the final position: `await expect.poll(async () => { const b = await dialog.boundingBox(); return b ? b.y + b.height / 2 < page.viewportSize()!.height / 2 : false; }).toBe(true);` then keep the bounding-box assertions. |
| `03c-ui-details.spec.ts:53` | Replace the wait and the last line with `await expect.poll(() => textContrast(middleDay), { message: 'text contrast of a day inside the range' }).toBeGreaterThanOrEqual(3);` (the colour transition ends within the poll). |
| `04-live-offline.spec.ts` | Points: `scorePoints(page, 5)` online, `scorePoints(page, 3)` offline. Serve stat (70–81): assert the player button and the serve card are visible and the success button enabled, then click (rule 1). Line 110 (`waitForTimeout(2_000)` to prove no reload) → keep the marker check but wait for the sync badge instead: `await waitForAllSaved(page)` then check the marker. |
| `04d-sync-reopen.spec.ts:39,67` | `scorePoints(page, 3)`. |
| `04e-scorer-takeover.spec.ts:27` | `scorePoints(page, 2)`; set `test.setTimeout(3 * 60_000)` (two devices). |
| `04f`, `04g`, `04h` | `setTimeout` calls drop to `test.setTimeout(2 * 60_000)` where present; point loops → `scorePoints`. |
| `04g-leave-live-match.spec.ts:119,123` | Moved to `06b` in Task 2; there, replace the `expect.poll` with `await expect(statsButton).toBeVisible({ timeout: 20_000 })`. |
| `05b-sw-cache.spec.ts:15` | Replace the 2 s wait with a wait for the data the page loads through Supabase: `await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 30_000 })` (a data row of the teams table; `networkidle` never settles because of RxDB sync). Tag the test title with ` @web`. |
| `07-team-detail-cleanup.spec.ts` | Delete the "delete E2E team (cleanup)" test (global teardown deletes e2e data). The detail test: rule 3 for search, then keep the assertions. Rename the file `07-team-detail.spec.ts`. |
| `tests/helpers/court.ts:56,66,78` | After clicking a court position, `await expect(page.getByRole('button', { name: new RegExp(players[i], 'i') }).first()).toBeVisible()` instead of the 100 ms wait; after choosing the player, wait for the role combobox text not to be empty instead of 150 ms; the manual-role branch stays (players without positions exist in other teams) but uses `await expect(lastCombobox).not.toHaveText(/Select role/i)` after choosing. |
| `tests/helpers/match-setup.ts` | Already rewritten in Task 2. |
| `tests/helpers/network.ts:14,25` | Replace the 400 ms waits with `await page.waitForFunction((online) => navigator.onLine === online, false)` (offline) / `true` (online). |

- [ ] **Step 3: Run the quick level and the stats project, three times**

Build/start, then run `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e` three times.
Expected: all pass three times. Record the durations of `core`+`live` (target about 1.5 min) and of the whole run.

- [ ] **Step 4: Try two workers**

Set `workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 1` in `playwright.config.ts` and set `fullyParallel: false` (unchanged). Run `E2E_WORKERS=2 CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e` three times. If all three pass, change the default to 2 and note the time saved; otherwise keep 1 and note the failures in the task report.

- [ ] **Step 5: CLAUDE.md "Which tests to run when"**

Replace the E2E lines of **Common Commands** in `CLAUDE.md` with:

```markdown
pnpm test             # Unit tests (Vitest)
pnpm test:e2e:quick   # E2E core + live projects (~1.5 min), during a task
pnpm test:e2e         # Full E2E, before merging
# E2E needs a production server and no `next dev` running:
# pnpm build && pnpm start -p 3100, then CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e[:quick]
# One area: --project=core|live|finished-match|stats (dependencies run automatically)
```

- [ ] **Step 6: Commit**

```bash
git add tests playwright.config.ts CLAUDE.md
git commit -m "test(e2e): assertions instead of silent steps and fixed waits; shorter teams spec"
```

## Phase B — Two build targets

### Task 4: Build switch and `.web.ts` server files (spike first)

**Files:**
- Modify: `next.config.js`, `package.json`
- Rename: `proxy.ts` → `proxy.web.ts`; `app/api/import/ffvb/route.ts` → `route.web.ts`; `app/api/v1/matches/[id]/report/route.ts` → `route.web.ts`; `app/auth/callback/route.ts` → `route.web.ts`; `app/serwist/[path]/route.ts` → `route.web.ts`

**Interfaces:**
- Produces: `BUILD_TARGET` (`web` default, `mobile`), `process.env.NEXT_PUBLIC_BUILD_TARGET` inlined in client code, script `build:mobile`.

- [ ] **Step 1: Rename the server files**

```bash
git mv proxy.ts proxy.web.ts
git mv app/api/import/ffvb/route.ts app/api/import/ffvb/route.web.ts
git mv "app/api/v1/matches/[id]/report/route.ts" "app/api/v1/matches/[id]/report/route.web.ts"
git mv app/auth/callback/route.ts app/auth/callback/route.web.ts
git mv "app/serwist/[path]/route.ts" "app/serwist/[path]/route.web.ts"
```

- [ ] **Step 2: Target switch in `next.config.js`**

```js
const { withSerwist } = require('@serwist/turbopack');
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

// `web`: the Vercel deployment (server routes, proxy, service worker).
// `mobile`: a static export in out/, bundled by the Capacitor app.
const target = process.env.BUILD_TARGET === 'mobile' ? 'mobile' : 'web';
const isWeb = target === 'web';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
  // Pin the project root: without it Next infers the root from the nearest
  // lockfile, which breaks module resolution in nested git worktrees.
  outputFileTracingRoot: __dirname,
  // Server-only files are named *.web.ts(x): only the web target treats them as Next files.
  pageExtensions: isWeb ? ['web.tsx', 'web.ts', 'tsx', 'ts', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js'],
  turbopack: { root: __dirname },
  env: { NEXT_PUBLIC_BUILD_TARGET: target },
  ...(isWeb
    ? {
        // @react-pdf/renderer runs in the report route from node_modules, with its fonts traced in.
        serverExternalPackages: ['@react-pdf/renderer'],
        outputFileTracingIncludes: { '/api/v1/matches/[id]/report': ['./lib/report/fonts/**'] },
      }
    : { output: 'export', trailingSlash: true }),
};

module.exports = isWeb ? withSerwist(withNextIntl(nextConfig)) : withNextIntl(nextConfig);
```

`BUILD_TARGET=mobile next build` doesn't work in a Windows shell, so set the variable from Node. Create `scripts/build-mobile.mjs`:

```js
#!/usr/bin/env node
// `next build` for the mobile target (static export in out/). Node sets the variable so it works on any OS.
import { spawnSync } from 'node:child_process';

const result = spawnSync('next', ['build'], { stdio: 'inherit', shell: true, env: { ...process.env, BUILD_TARGET: 'mobile' } });
process.exit(result.status ?? 1);
```

Add to `package.json` scripts:

```json
"build:mobile": "node scripts/build-mobile.mjs",
```

- [ ] **Step 3: Spike — the web target still sees the renamed files**

Run: `pnpm build`
Expected: succeeds; the route list printed at the end contains `ƒ /api/v1/matches/[id]/report`, `ƒ /api/import/ffvb`, `ƒ /auth/callback`, `ƒ /serwist/[path]`, and `ƒ Proxy (Middleware)`.
Then `pnpm start -p 3100` and check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/serwist/sw.js` → `200`; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/teams` → `307` (proxy auth redirect still on). Stop the server.

If any of these fail, Next does not honour the suffix for that file type: stop and report to the user with the build output; the fallback (spec §1) is a build script that copies the repo without `*.web.*` files for the mobile build.

- [ ] **Step 4: Spike — the mobile target ignores them**

Run: `pnpm build:mobile`
Expected: the build **fails**, but only on the blockers later tasks remove — dynamic segments without `generateStaticParams` (`/matches/[id]/...`, `/teams/[id]`, `/championships/[id]`) and/or `cookies`/`headers` from the layout's next-intl. It must **not** mention `route`, `proxy`, `/api/` or `serwist`. Record the error text in the task report.

- [ ] **Step 5: Quick e2e on web**

Run the core and live projects (Global Constraints). Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add -A next.config.js package.json scripts/build-mobile.mjs proxy.web.ts app
git commit -m "build: BUILD_TARGET web|mobile; server-only files carry a .web suffix"
```

### Task 5: Platform seam, server folder, ESLint boundaries

**Files:**
- Create: `lib/platform/types.ts`, `lib/platform/index.ts`, `lib/platform/supabase-config.ts`, `lib/platform/web/index.ts`, `lib/platform/web/service-worker.tsx`, `lib/platform/mobile/index.ts`, `lib/platform/shared/sync.ts` (moved), `lib/platform/shared/passthrough.tsx`, `lib/api-url.ts`, `lib/api-client.ts`
- Move: `lib/rxdb/sync/platform/web.ts` → `lib/platform/shared/sync.ts`; `lib/supabase/server.ts` → `lib/server/supabase.ts`; `lib/supabase/middleware.ts` → `lib/server/session.ts`; `lib/report/caller.ts` → `lib/server/report-caller.ts`
- Modify: `next.config.js`, `tsconfig.json`, `vitest.config.ts`, `lib/supabase/client.ts`, `lib/rxdb/database.ts`, `components/providers/service-worker-provider.tsx`, `app/matches/[id]/stats/page.tsx`, `app/championships/[id]/page.tsx`, `app/api/import/ffvb/route.web.ts`, `app/api/v1/matches/[id]/report/route.web.ts`, `proxy.web.ts`, `eslint.config.mjs`, `tests/unit/sync/platform-web.test.ts`
- Test: `tests/unit/platform/api-client.test.ts`

**Interfaces:**
- Produces:

```ts
// lib/platform/types.ts
export type BuildTarget = "web" | "mobile";
export interface Platform {
  target: BuildTarget;
  /** Origin of the web deployment's API: "" on web (same origin), NEXT_PUBLIC_API_ORIGIN on mobile. */
  apiOrigin: string;
  /** Origin for links that leave the app (auth emails, shared stats links). */
  webOrigin(): string;
  createSupabaseClient(): SupabaseClient<Database>;
  ServiceWorker: ComponentType<{ children: ReactNode }>;
  saveFile(data: Blob, fileName: string): Promise<void>;
  createSyncPlatform(): SyncPlatform;
}
// lib/platform/index.ts
export const platform: Platform;
// lib/api-url.ts (no imports: unit-testable)
export function apiUrl(path: string, origin: string): string;
// lib/api-client.ts
export async function apiFetch(path: string, init?: RequestInit): Promise<Response>;
// lib/server/session.ts
export async function updateSession(request: NextRequest): Promise<NextResponse>;
// lib/server/supabase.ts
export async function createClient(): Promise<SupabaseClient<Database>>; // service role, key read on call
```

- [ ] **Step 1: Failing test for `apiUrl`**

Create `tests/unit/platform/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { apiUrl } from "@/lib/api-url";

describe("apiUrl", () => {
  it("keeps same-origin paths on web", () => {
    expect(apiUrl("/api/v1/matches/1/report", "")).toBe("/api/v1/matches/1/report");
  });
  it("prefixes the API origin on mobile, without a double slash", () => {
    expect(apiUrl("/api/v1/x", "https://volley.example")).toBe("https://volley.example/api/v1/x");
    expect(apiUrl("/api/v1/x", "https://volley.example/")).toBe("https://volley.example/api/v1/x");
  });
  it("rejects paths that are not absolute", () => {
    expect(() => apiUrl("api/v1/x", "")).toThrow();
  });
});
```

Run: `pnpm vitest run tests/unit/platform/api-client.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 2: Types, config and shared pieces**

`lib/platform/types.ts`:

```ts
import type { ComponentType, ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";

export type BuildTarget = "web" | "mobile";

/** Everything that differs between the web deployment and the Capacitor app. Chosen at build time. */
export interface Platform {
  target: BuildTarget;
  /** Origin of the web deployment's API: "" on web (same origin), NEXT_PUBLIC_API_ORIGIN on mobile. */
  apiOrigin: string;
  /** Origin for links that leave the app (auth emails, shared stats links). */
  webOrigin(): string;
  createSupabaseClient(): SupabaseClient<Database>;
  ServiceWorker: ComponentType<{ children: ReactNode }>;
  saveFile(data: Blob, fileName: string): Promise<void>;
  createSyncPlatform(): SyncPlatform;
}
```

`lib/platform/supabase-config.ts`:

```ts
// Literal process.env reads: Next inlines NEXT_PUBLIC_* values only when written out in full.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfig(): { url: string; anonKey: string } {
  if (!url || !anonKey) throw new Error("Missing Supabase environment variables");
  return { url, anonKey };
}
```

Move the sync platform: `git mv lib/rxdb/sync/platform/web.ts lib/platform/shared/sync.ts`; fix its import to `import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";`. Update `tests/unit/sync/platform-web.test.ts` import to `@/lib/platform/shared/sync`.

`lib/platform/shared/passthrough.tsx`:

```tsx
import type { ReactNode } from "react";

export function Passthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 3: Web and mobile implementations**

`lib/platform/web/service-worker.tsx`: move the body of `components/providers/service-worker-provider.tsx` here as `export function WebServiceWorker(...)` (keep `'use client'` and the comment).

`lib/platform/web/index.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { saveBlob } from "@/lib/report/download";
import { createWebPlatform } from "../shared/sync";
import { supabaseConfig } from "../supabase-config";
import type { Platform } from "../types";
import { WebServiceWorker } from "./service-worker";

export const platform: Platform = {
  target: "web",
  apiOrigin: "",
  webOrigin: () => (typeof window === "undefined" ? process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "" : window.location.origin),
  createSupabaseClient: () => {
    const { url, anonKey } = supabaseConfig();
    // Cookie session: the proxy refreshes it and the report route can read it.
    return createBrowserClient<Database>(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  },
  ServiceWorker: WebServiceWorker,
  saveFile: async (data, fileName) => saveBlob(data, fileName),
  createSyncPlatform: createWebPlatform,
};
```

`lib/platform/mobile/index.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { saveBlob } from "@/lib/report/download";
import { Passthrough } from "../shared/passthrough";
import { createWebPlatform } from "../shared/sync";
import { supabaseConfig } from "../supabase-config";
import type { Platform } from "../types";

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
const webOrigin = process.env.NEXT_PUBLIC_WEB_ORIGIN;
if (!apiOrigin || !webOrigin) throw new Error("The mobile build needs NEXT_PUBLIC_API_ORIGIN and NEXT_PUBLIC_WEB_ORIGIN");

// Browser stand-ins for now: sub-project 2 replaces saveFile, the sync signals and storage with Capacitor plugins.
export const platform: Platform = {
  target: "mobile",
  apiOrigin,
  webOrigin: () => webOrigin,
  createSupabaseClient: () => {
    const { url, anonKey } = supabaseConfig();
    return createClient<Database>(url, anonKey, {
      auth: {
        storage: typeof window === "undefined" ? undefined : window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Email links are handled by /auth/confirm.
        detectSessionInUrl: false,
      },
    });
  },
  ServiceWorker: Passthrough,
  saveFile: async (data, fileName) => saveBlob(data, fileName),
  createSyncPlatform: createWebPlatform,
};
```

`lib/platform/index.ts`:

```ts
// The implementation is chosen at build time: @platform-impl points at ./web or ./mobile (next.config.js).
export { platform } from "@platform-impl";
export type { BuildTarget, Platform } from "./types";
```

- [ ] **Step 4: Alias in Next, TypeScript and Vitest**

`next.config.js`: change `turbopack` to

```js
  turbopack: {
    root: __dirname,
    resolveAlias: { '@platform-impl': isWeb ? './lib/platform/web/index.ts' : './lib/platform/mobile/index.ts' },
  },
```

`tsconfig.json` `paths`: add `"@platform-impl": ["./lib/platform/web/index.ts"]` (typecheck against the web implementation; `satisfies`-style checking of mobile comes from its `Platform` annotation).

`vitest.config.ts` `resolve.alias`: add `"@platform-impl": fileURLToPath(new URL("./lib/platform/web/index.ts", import.meta.url))`.

- [ ] **Step 5: `apiFetch`**

`lib/api-url.ts`:

```ts
/** The URL of a web-deployment API path: same origin on web (""), the API origin in the app. */
export function apiUrl(path: string, origin: string): string {
  if (!path.startsWith("/")) throw new Error(`API paths start with "/": ${path}`);
  return origin.replace(/\/$/, "") + path;
}
```

`lib/api-client.ts`:

```ts
import { apiUrl } from "@/lib/api-url";
import { platform } from "@/lib/platform";
import { supabase } from "@/lib/supabase/client";

/** Calls the web deployment's API with the caller's Supabase access token (same check on web and mobile). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(apiUrl(path, platform.apiOrigin), { ...init, headers });
}
```

Run: `pnpm vitest run tests/unit/platform/api-client.test.ts` — Expected: PASS.

- [ ] **Step 6: Use the seam**

- `lib/supabase/client.ts`: replace the body with

```ts
import { platform } from "@/lib/platform";

export function createClient() {
  return platform.createSupabaseClient();
}

export const supabase = createClient();
```

  Remove `createJsClient` if `grep -rn createJsClient app components lib hooks contexts` shows no caller (only the definition).
- `lib/rxdb/database.ts`: replace the `createWebPlatform` import with `import { platform } from "@/lib/platform";` and use `platform: platform.createSyncPlatform()`.
- `components/providers/service-worker-provider.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { platform } from '@/lib/platform';

export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const ServiceWorker = platform.ServiceWorker;
  return <ServiceWorker>{children}</ServiceWorker>;
}
```

- `app/matches/[id]/stats/page.tsx` `exportReport`: `const response = await apiFetch(\`/api/v1/matches/${matchId}/report?team=${encodeURIComponent(managedTeam.id)}&locale=${locale}\`);` and `await platform.saveFile(await response.blob(), fileName);`.
- `app/championships/[id]/page.tsx` `handleRefresh`: keep `fetch('/api/import/ffvb', …)` (web only, see Task 10).

- [ ] **Step 7: Server folder, key read on use**

```bash
git mv lib/supabase/server.ts lib/server/supabase.ts
git mv lib/supabase/middleware.ts lib/server/session.ts
git mv lib/report/caller.ts lib/server/report-caller.ts
```

In `lib/server/supabase.ts`, move the env check into `createClient()` so imports don't need the key:

```ts
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase environment variables for server');
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, serviceKey, { cookies: { /* unchanged */ } });
}
```

Fix the imports: `proxy.web.ts` (`@/lib/server/session`), `app/api/import/ffvb/route.web.ts` (`@/lib/server/supabase`), `app/api/v1/matches/[id]/report/route.web.ts` (`@/lib/server/report-caller`), `app/auth/callback/route.web.ts` (`@/lib/server/supabase`), and any test importing `@/lib/report/caller` (`grep -rn "report/caller\|supabase/server\|supabase/middleware" app lib tests`). `lib/server/session.ts` keeps `@supabase/ssr`.

- [ ] **Step 8: ESLint boundaries**

Append to the array in `eslint.config.mjs` (before `globalIgnores`):

```js
  {
    // Server-only modules: only in *.web.ts(x) files (web target) and lib/server/.
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.web.ts', '**/*.web.tsx', 'lib/server/**', 'tests/**', 'scripts/**'],
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
```

Run: `npx eslint lib app components proxy.web.ts` — Expected: no `no-restricted-imports` errors. `app/layout.tsx` imports `next-intl/server` until Task 9: add `// eslint-disable-next-line no-restricted-imports -- removed by the client locale (Task 9)` above that import for now. `lib/i18n/actions.ts` and `lib/i18n/locale.ts` are deleted in Task 9; add the same one-line disable there.

- [ ] **Step 9: Verify**

Run: `pnpm test` (PASS), `npx tsc --noEmit` (no new errors), the lint gate, `pnpm build` (succeeds). Start the server, run `CI=1 BASE_URL=http://localhost:3100 npx playwright test --project=stats --project=core` (stats covers the PDF export through `apiFetch`). Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add -A lib app components proxy.web.ts next.config.js tsconfig.json vitest.config.ts eslint.config.mjs tests
git commit -m "feat(platform): lib/platform seam, apiFetch, lib/server, import boundaries"
```

## Phase C — Routes

### Task 6: Query-param routes, link builders, web redirects

**Files:**
- Create: `lib/routes.ts`, `hooks/use-route-id.ts`, `tests/unit/routes/routes.test.ts`, `tests/e2e/09-routes.spec.ts`, `tests/helpers/routes.ts`
- Move: `app/matches/[id]/live/{layout,page}.tsx` → `app/matches/live/`; `app/matches/[id]/score/page.tsx` → `app/matches/score/page.tsx`; `app/matches/[id]/stats/page.tsx` → `app/matches/stats/page.tsx`; `app/teams/[id]/page.tsx` → `app/teams/view/page.tsx`; `app/teams/[id]/players/page.tsx` → `app/teams/players/page.tsx`; `app/championships/[id]/page.tsx` → `app/championships/view/page.tsx`
- Modify: `next.config.js`, `components/navigation.tsx`, `components/matches/match-{edit,score,start,stats}-dialog.tsx`, `components/teams/team-table.tsx`, `components/championships/championship-{list,teams-list}.tsx`, `app/layout.tsx` (Suspense around `LoadingBar`), `app/auth/page.tsx`, `app/auth/confirm-email/page.tsx`, the moved pages, e2e specs/helpers that build or match URLs

**Interfaces:**
- Produces:

```ts
// lib/routes.ts
export type QueryParams = Record<string, string | null | undefined>;
export const routes: {
  home(): string; signIn(redirectTo?: string | null): string; matches(): string;
  matchLive(id: string, params?: QueryParams): string; matchScore(id: string, params?: QueryParams): string;
  matchStats(id: string, params?: QueryParams): string; teams(): string; team(id: string): string;
  teamPlayers(id: string): string; championship(id: string): string;
};
export function normalizePath(pathname: string): string;      // "/matches/live/" -> "/matches/live"
export function isPublicPath(pathname: string): boolean;
export function isSafeRedirectTarget(target: string | null | undefined): target is string;
export function parseRouteId(value: string | null | undefined): string | null;
export const LEGACY_ROUTE_REDIRECTS: { source: string; destination: string }[];
// hooks/use-route-id.ts
export function useRouteId(): string | null;
```

- [ ] **Step 1: Failing unit tests**

`tests/unit/routes/routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPublicPath, isSafeRedirectTarget, normalizePath, parseRouteId, routes } from "@/lib/routes";

const ID = "3f2b8c1e-9d4a-4b6f-8e2a-1c5d7e9f0a1b";

describe("routes", () => {
  it("builds query-param routes, dropping empty params", () => {
    expect(routes.matchLive(ID)).toBe(`/matches/live?id=${ID}`);
    expect(routes.matchStats(ID, { team: "t1", empty: "" })).toBe(`/matches/stats?id=${ID}&team=t1`);
    expect(routes.teamPlayers(ID)).toBe(`/teams/players?id=${ID}`);
    expect(routes.championship(ID)).toBe(`/championships/view?id=${ID}`);
    expect(routes.signIn("/teams?x=1")).toBe("/auth?redirectTo=%2Fteams%3Fx%3D1");
    expect(routes.signIn()).toBe("/auth");
  });
  it("normalizes trailing slashes", () => {
    expect(normalizePath("/matches/live/")).toBe("/matches/live");
    expect(normalizePath("/")).toBe("/");
  });
  it("knows the public paths", () => {
    for (const p of ["/", "/auth", "/auth/confirm", "/auth/reset-password/", "/matches/stats", "/matches/stats/"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/matches", "/matches/live", "/teams", "/settings", "/authx"]) expect(isPublicPath(p)).toBe(false);
  });
  it("accepts only in-app redirect targets", () => {
    expect(isSafeRedirectTarget("/teams/players?id=1")).toBe(true);
    for (const t of [null, "", "//evil.com", "https://evil.com", "/auth", "/auth/confirm", "/api/v1/x", "/_next/x", "/icon.png", "teams"]) {
      expect(isSafeRedirectTarget(t)).toBe(false);
    }
  });
  it("parses route ids", () => {
    expect(parseRouteId(ID)).toBe(ID);
    expect(parseRouteId(ID.toUpperCase())).toBe(ID);
    for (const v of [null, undefined, "", "abc", `${ID}x`]) expect(parseRouteId(v)).toBeNull();
  });
});
```

Run: `pnpm vitest run tests/unit/routes` — Expected: FAIL (module not found).

- [ ] **Step 2: `lib/routes.ts`**

```ts
/** Every in-app URL is built here. Ids travel as ?id= so the static export has one HTML file per page. */
export type QueryParams = Record<string, string | null | undefined>;

const withQuery = (path: string, params: QueryParams = {}): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const routes = {
  home: () => "/",
  signIn: (redirectTo?: string | null) => withQuery("/auth", { redirectTo }),
  matches: () => "/matches",
  matchLive: (id: string, params: QueryParams = {}) => withQuery("/matches/live", { id, ...params }),
  matchScore: (id: string, params: QueryParams = {}) => withQuery("/matches/score", { id, ...params }),
  matchStats: (id: string, params: QueryParams = {}) => withQuery("/matches/stats", { id, ...params }),
  teams: () => "/teams",
  team: (id: string) => withQuery("/teams/view", { id }),
  teamPlayers: (id: string) => withQuery("/teams/players", { id }),
  championship: (id: string) => withQuery("/championships/view", { id }),
};

/** The static export uses trailing slashes; compare paths without them. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Pages a signed-out visitor may open: the landing page, sign-in and email links, shared match stats. */
export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/" || path === "/auth" || path.startsWith("/auth/") || path === "/matches/stats";
}

const TECHNICAL_FILE = /\.(webmanifest|json|xml|ico|png|jpe?g|gif|svg|webp|css|js|woff2?|ttf|eot|txt)$/i;

/** A redirectTo value that stays in the app and leads to a page worth returning to. */
export function isSafeRedirectTarget(target: string | null | undefined): target is string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.includes("://")) return false;
  const path = normalizePath(target.split(/[?#]/)[0]);
  if (path === "/auth" || path.startsWith("/auth/") || path.startsWith("/api/") || path.startsWith("/_next/")) return false;
  return !TECHNICAL_FILE.test(path);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRouteId(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value.toLowerCase() : null;
}

const ID = ":id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

/** Old dynamic URLs (web only). The UUID pattern keeps /teams/new and the new routes out. */
export const LEGACY_ROUTE_REDIRECTS = [
  { source: `/matches/${ID}/live`, destination: "/matches/live?id=:id" },
  { source: `/matches/${ID}/score`, destination: "/matches/score?id=:id" },
  { source: `/matches/${ID}/stats`, destination: "/matches/stats?id=:id" },
  { source: `/teams/${ID}/players`, destination: "/teams/players?id=:id" },
  { source: `/teams/${ID}`, destination: "/teams/view?id=:id" },
  { source: `/championships/${ID}`, destination: "/championships/view?id=:id" },
];
```

Run: `pnpm vitest run tests/unit/routes` — Expected: PASS.

- [ ] **Step 3: Redirects (web target)**

`next.config.js` is CommonJS and can't import TS: copy the six entries of `LEGACY_ROUTE_REDIRECTS` into `next.config.js` as a `LEGACY_ROUTE_REDIRECTS` array with a comment `// Keep in sync with LEGACY_ROUTE_REDIRECTS in lib/routes.ts (tests/unit/routes/legacy-redirects.test.ts checks it)`, and add in the web branch:

```js
        async redirects() {
          // Next keeps the original query string (e.g. ?team=) on top of the destination's.
          return LEGACY_ROUTE_REDIRECTS.map((r) => ({ ...r, permanent: true }));
        },
```

Add `tests/unit/routes/legacy-redirects.test.ts`:

```ts
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LEGACY_ROUTE_REDIRECTS } from "@/lib/routes";

describe("next.config.js redirects", () => {
  it("match lib/routes.ts", async () => {
    const config = createRequire(import.meta.url)("../../../next.config.js");
    const redirects = await config.redirects();
    expect(redirects).toEqual(LEGACY_ROUTE_REDIRECTS.map((r) => ({ ...r, permanent: true })));
  });
});
```

Run it — Expected: PASS (`BUILD_TARGET` unset means web). If requiring `next.config.js` pulls Serwist/next-intl plugins that fail in Vitest, export the array from a plain `lib/legacy-redirects.js` (CommonJS, no imports) required by both `next.config.js` and `lib/routes.ts`, and test that instead.

- [ ] **Step 4: `useRouteId` and the six pages**

`hooks/use-route-id.ts`:

```ts
"use client";

import { useSearchParams } from "next/navigation";
import { parseRouteId } from "@/lib/routes";

/** The page's ?id=, or null when missing or not a UUID. Call under a <Suspense> boundary. */
export function useRouteId(): string | null {
  return parseRouteId(useSearchParams().get("id"));
}
```

Move the pages:

```bash
git mv "app/matches/[id]/live" app/matches/live
git mv "app/matches/[id]/score" app/matches/score
git mv "app/matches/[id]/stats" app/matches/stats
git mv "app/teams/[id]/players" app/teams/players
git mv "app/teams/[id]/page.tsx" app/teams/view/page.tsx
git mv "app/championships/[id]/page.tsx" app/championships/view/page.tsx
```

(Create `app/teams/view/` and `app/championships/view/` first if `git mv` needs the directory.) Remove the empty `[id]` directories.

In each moved page, keep the existing component but take the id as a prop, and wrap it. Example for `app/matches/live/page.tsx` (current default export `LiveMatchPage` at the top of the file uses `const { id: matchId } = useParams<{ id: string }>();`):

```tsx
// at the bottom of the imports
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LoadingPage } from "@/components/loading-page";
import { useRouteId } from "@/hooks/use-route-id";

function LiveMatchRoute() {
  const matchId = useRouteId();
  if (!matchId) notFound();
  return <LiveMatchPage matchId={matchId} />;
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <LiveMatchRoute />
    </Suspense>
  );
}
```

and change `export default function LiveMatchPage()` to `function LiveMatchPage({ matchId }: { matchId: string })`, deleting its `useParams` line (and `useParams` from the import if unused). Do the same for:
- `app/matches/score/page.tsx`: `const { id: matchId } = useParams();` → prop `matchId`.
- `app/matches/stats/page.tsx`: same.
- `app/teams/view/page.tsx`: `const { id } = useParams();` → prop `id`.
- `app/teams/players/page.tsx`: `const params = useParams();` → prop `id`; replace `params.id` uses with `id`.
- `app/championships/view/page.tsx`: same as players.

Keep the existing `Suspense` usage if a page already has one around `useSearchParams` content.

- [ ] **Step 5: Every link goes through `routes`**

Replace each hand-built URL (found by `grep -rnE "/(matches|teams|championships)/\\$\\{" app components hooks contexts lib`):

| Site | New code |
|---|---|
| `components/matches/match-edit-dialog.tsx:55` | `router.push(routes.matchLive(match.id, Object.fromEntries(params)));` |
| `components/matches/match-start-dialog.tsx:113` | same |
| `components/matches/match-score-dialog.tsx:54` | `router.push(routes.matchScore(match.id, Object.fromEntries(params)));` |
| `components/matches/match-stats-dialog.tsx:54` | `router.push(routes.matchStats(match.id, Object.fromEntries(params)));` |
| `app/matches/live/page.tsx` (Match Statistics button, old line 797) | `router.push(routes.matchStats(matchState.match!.id, { team: managedTeam!.id }));` |
| `app/teams/view/page.tsx:237` | `href={routes.championship(team.championships.id)}` |
| `components/championships/championship-list.tsx:117` | `href={routes.championship(championship.id)}` |
| `components/championships/championship-teams-list.tsx:119,126` | `routes.team(team.id)`, `routes.teamPlayers(team.id)` |
| `components/teams/team-table.tsx:99,109,164,173` | `routes.team(team.id)`, `routes.teamPlayers(team.id)` |
| `app/matches/stats/page.tsx` `shareStats` | `url: platform.webOrigin() + routes.matchStats(matchId, Object.fromEntries(searchParams))` (import `platform`; `searchParams` from `useSearchParams()` already in the page) |
| `components/navigation.tsx:88` | `const isLivePage = normalizePath(pathname ?? "") === "/matches/live";` |
| `components/navigation.tsx` active-route checks (`pathname === route.href`) | `normalizePath(pathname ?? "") === route.href` |

Also wrap `<LoadingBar />` in `app/layout.tsx` as `<Suspense fallback={null}><LoadingBar /></Suspense>`, and wrap the content of `app/auth/page.tsx` and `app/auth/confirm-email/page.tsx` in `<Suspense>` the same way as the pages above (they call `useSearchParams`; the export requires the boundary).

- [ ] **Step 6: E2E URL helpers and specs**

`tests/helpers/routes.ts`:

```ts
/** The id of a query-param route URL (/matches/live?id=… or /matches/live/?id=… in the export). */
export function routeId(url: string): string {
  const id = new URL(url).searchParams.get('id');
  if (!id) throw new Error(`No ?id= in ${url}`);
  return id;
}
export const onPath = (path: string) => (url: URL) => url.pathname.replace(/\/+$/, '') === path;
```

Update the URL checks found by `grep -rn "waitForURL\|toHaveURL\|page.url()\|goto(\`/" tests`:
- `match-setup.ts`: `await page.waitForURL((url) => onPath('/matches/live')(url) && url.searchParams.get('id') === matchId, { timeout: 15_000 });` (drop the old-path branch).
- `01b`: `page.goto(routes.teamPlayers(teamId))`, team page `page.goto(routes.team(teamId))` (import `routes` from `@/lib/routes`; Playwright resolves tsconfig paths).
- `02`: after the stats button, `await page.waitForURL(onPath('/matches/stats'))`.
- `03-championships`: `await page.waitForURL(onPath('/championships/view'))`; `const championshipId = routeId(page.url())`.
- `06`, `06b`, `06z`: `page.goto(routes.matchStats(completedMatchId, { team: teamId }))`, `routes.matchLive(...)`, `routes.championship(...)`.
- `04g`: `waitForURL(/\/matches$/)` → `waitForURL(onPath('/matches'))`; `/\/teams$/` → `onPath('/teams')`.
- `07-team-detail`: `waitForURL(onPath('/teams/view'))`.
- `01-teams`: `waitForURL(onPath('/teams/players'))`.

- [ ] **Step 7: Redirect and not-found e2e**

`tests/e2e/09-routes.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { onPath } from '../helpers/routes';

test('old URLs redirect to the query-param routes, keeping their query @web', async ({ page }) => {
  const { teamId, completedMatchId } = readFixture();
  await page.goto(`/teams/${teamId}/players`);
  await expect(page).toHaveURL((url) => onPath('/teams/players')(url) && url.searchParams.get('id') === teamId);
  await page.goto(`/teams/${teamId}`);
  await expect(page).toHaveURL((url) => onPath('/teams/view')(url) && url.searchParams.get('id') === teamId);
  await page.goto('/teams/new');
  await expect(page).toHaveURL(onPath('/teams/new'));
  if (completedMatchId) {
    await page.goto(`/matches/${completedMatchId}/stats?team=${teamId}`);
    await expect(page).toHaveURL(
      (url) => onPath('/matches/stats')(url) && url.searchParams.get('id') === completedMatchId && url.searchParams.get('team') === teamId
    );
  }
});

test('a route without a valid id shows the not-found page', async ({ page }) => {
  for (const path of ['/matches/live', '/teams/view?id=abc']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/not found|404/i);
  }
});
```

Check the heading text the not-found page renders (`app/not-found.tsx`) and adjust the regex to it. Place `09-routes.spec.ts` in the `stats` project (it reads `completedMatchId`): add `'**/09-routes.spec.ts'` to `STATS` in `playwright.config.ts`.

- [ ] **Step 8: Verify**

`pnpm test` (PASS); lint gate; `npx tsc --noEmit`; `pnpm build` (route list shows `/matches/live`, `/matches/stats`, `/teams/view`, `/teams/players`, `/championships/view`, no `[id]`). Start the server; run `pnpm test:e2e` (full: every spec builds URLs). Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add -A app components hooks lib next.config.js tests playwright.config.ts
git commit -m "feat(routes): query-param routes for matches, teams and championships; old URLs redirect"
```

## Phase D — Auth

### Task 7: Client-side auth guard; the proxy stops redirecting

**Files:**
- Create: `components/auth/auth-guard.tsx`, `tests/e2e/10-auth-guard.spec.ts`
- Modify: `app/layout.tsx`, `lib/server/session.ts`, `app/auth/page.tsx`, `components/auth/auth-form.tsx`

**Interfaces:**
- Consumes: `isPublicPath`, `isSafeRedirectTarget`, `routes.signIn` (Task 6); `useAuth()` (`user`, `session`, `isLoading`).
- Produces: `<AuthGuard>{children}</AuthGuard>`.

- [ ] **Step 1: Failing e2e**

`tests/e2e/10-auth-guard.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { routes } from '@/lib/routes';

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a protected deep link goes to sign-in and comes back to the same page', async ({ page }) => {
    const { teamId } = readFixture();
    const target = routes.teamPlayers(teamId);
    await page.goto(target);
    await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/auth' && url.searchParams.get('redirectTo') === target);
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/teams/players' && url.searchParams.get('id') === teamId);
  });

  test('an unsafe redirectTo falls back to the home page', async ({ page }) => {
    await page.goto('/auth?redirectTo=%2F%2Fevil.com');
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.host.startsWith('localhost'));
  });
});
```

(`core` project.) Build, start, run `npx playwright test --project=core -g "signed out"`. Expected: the second test **fails** (the sign-in form follows `//evil.com`). The first passes today only because the proxy redirects; Step 3 removes that redirect, so after Step 3 both must pass through the client guard alone.

- [ ] **Step 2: The guard**

`components/auth/auth-guard.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingPage } from "@/components/loading-page";
import { useAuth } from "@/contexts/auth-context";
import { isPublicPath, isSafeRedirectTarget, routes } from "@/lib/routes";

/** Pages other than the public ones need a signed-in user; others go to sign-in and come back. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, session, isLoading } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isPublic = isPublicPath(pathname);
  const signedOut = !isLoading && !user && !session;

  useEffect(() => {
    if (isPublic || !signedOut) return;
    // window.location, not useSearchParams: no Suspense boundary needed around the whole app.
    const target = pathname + window.location.search;
    router.replace(routes.signIn(isSafeRedirectTarget(target) ? target : null));
  }, [isPublic, signedOut, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (isLoading || signedOut) return <LoadingPage />;
  return <>{children}</>;
}
```

In `app/layout.tsx`, wrap `{children}` inside `<main>`: `<AuthGuard>{children}</AuthGuard>`.

- [ ] **Step 3: Safe redirects after sign-in; proxy without the redirect**

`app/auth/page.tsx` and `components/auth/auth-form.tsx`: replace `router.replace(redirectTo || "/")` with

```ts
const redirectTo = searchParams.get("redirectTo");
router.replace(isSafeRedirectTarget(redirectTo) ? redirectTo : "/");
```

`lib/server/session.ts`: delete `shouldSaveRedirect` and the whole `if (!user && …) { … return NextResponse.redirect(url) }` block; keep the cookie refresh (`await supabase.auth.getClaims()` stays, it refreshes the session). Update the file comment: "Refreshes the Supabase session cookie. Pages are guarded on the client (components/auth/auth-guard.tsx)."

- [ ] **Step 4: Verify**

Lint gate, `npx tsc --noEmit`, `pnpm build`, start; run `npx playwright test --project=core --project=stats`. Expected: pass (including `06` "stats page is reachable without signing in" and `10-auth-guard`).

- [ ] **Step 5: Commit**

```bash
git add components/auth app/layout.tsx app/auth lib/server/session.ts tests/e2e/10-auth-guard.spec.ts
git commit -m "feat(auth): client-side guard on both targets; the proxy only refreshes the session"
```

### Task 8: `token_hash` auth links and `/auth/confirm`

**Files:**
- Create: `supabase/functions/send-email/_confirm-url.ts`, `tests/unit/auth/confirm-url.test.ts`, `app/auth/confirm/page.tsx`, `tests/e2e/11-auth-confirm.spec.ts`
- Modify: `supabase/functions/send-email/index.ts`, `supabase/functions/send-email/_templates/{sign-up,recovery,magic-link}.tsx`, `components/auth/auth-form.tsx`, `messages/*/auth.json`

**Interfaces:**
- Produces: `buildConfirmUrl({ siteUrl, redirectTo, tokenHash, type }): string` → `<origin>/auth/confirm?token_hash=…&type=…&next=…`.

- [ ] **Step 1: Failing unit test**

`tests/unit/auth/confirm-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildConfirmUrl } from "@/supabase/functions/send-email/_confirm-url";

describe("buildConfirmUrl", () => {
  it("points at /auth/confirm on the redirect's origin, with the redirect's path as next", () => {
    const url = new URL(buildConfirmUrl({ siteUrl: "https://site.example", redirectTo: "https://app.example/settings?tab=1", tokenHash: "abc", type: "email_change" }));
    expect(url.origin).toBe("https://app.example");
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("abc");
    expect(url.searchParams.get("type")).toBe("email_change");
    expect(url.searchParams.get("next")).toBe("/settings?tab=1");
  });
  it("falls back to the site URL and no next when the redirect is missing or invalid", () => {
    for (const redirectTo of ["", "not a url"]) {
      const url = new URL(buildConfirmUrl({ siteUrl: "https://site.example/", redirectTo, tokenHash: "h", type: "signup" }));
      expect(url.origin).toBe("https://site.example");
      expect(url.searchParams.has("next")).toBe(false);
    }
  });
  it("drops the old /auth/callback and locale-prefixed /auth redirects (they are not pages to return to)", () => {
    for (const redirectTo of ["https://app.example/auth/callback?type=recovery", "https://app.example/fr/auth"]) {
      const url = new URL(buildConfirmUrl({ siteUrl: "https://site.example", redirectTo, tokenHash: "h", type: "recovery" }));
      expect(url.searchParams.has("next")).toBe(false);
    }
  });
});
```

`tsconfig.json` excludes `supabase/`, but Vitest resolves `@/supabase/...` through its alias; the helper must not use Deno APIs. Run: `pnpm vitest run tests/unit/auth` — Expected: FAIL (module not found).

- [ ] **Step 2: The helper**

`supabase/functions/send-email/_confirm-url.ts`:

```ts
/**
 * Link of an auth email: the app's /auth/confirm page verifies the token_hash (works in any browser, and
 * in the mobile app through universal links). Plain TypeScript, no Deno APIs: unit-tested from the app.
 */
export function buildConfirmUrl(input: { siteUrl: string; redirectTo: string; tokenHash: string; type: string }): string {
  let origin = new URL(input.siteUrl).origin;
  let next: string | null = null;
  try {
    const redirect = new URL(input.redirectTo);
    origin = redirect.origin;
    const path = redirect.pathname.replace(/\/+$/, "") || "/";
    // Sign-in pages (/auth, /auth/callback, the old /fr/auth) are not pages to come back to.
    const isAuthPage = /^\/([a-z]{2}\/)?auth(\/|$)/.test(path);
    if (!isAuthPage && path !== "/") next = path + redirect.search;
  } catch {
    // No usable redirect: the site URL, and home after confirming.
  }
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", input.type);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
```

Run the unit test — Expected: PASS.

- [ ] **Step 3: Use it in the hook and templates**

In `supabase/functions/send-email/index.ts`, import `buildConfirmUrl` from `./_confirm-url.ts`, compute once after verifying the payload:

```ts
const confirm_url = buildConfirmUrl({ siteUrl: resolved_site_url, redirectTo: redirect_to, tokenHash: token_hash, type: email_action_type })
```

(`resolved_site_url` is the variable the file already passes as `site_url`; if it is defined later, move this line after it.) Pass `confirm_url` to `SignUpEmail`, `RecoveryEmail` and `MagicLinkEmail` instead of `supabase_url`, `token_hash`, `redirect_to`; remove `redirect_to + lang + '/auth'`. In each template replace the `confirmUrl` line with the `confirm_url` prop and update the props interface (`confirm_url: string`; delete `supabase_url`, `token_hash`, `redirect_to` if no longer used).

Do **not** deploy the function: deployment happens after the web deploy (spec "Rollout order"); Task 14 lists it in the hand-off.

- [ ] **Step 4: The confirm page**

Add to `messages/en/auth.json` (and the same keys, translated, in `fr`, `es`, `it`, `pt`):

```json
"confirmLink": {
  "verifying": "Confirming your link…",
  "invalidTitle": "This link is invalid or has expired",
  "invalidBody": "Request a new email from the sign-in page.",
  "backToSignIn": "Back to sign in"
}
```

fr: `"Confirmation de votre lien…"`, `"Ce lien est invalide ou a expiré"`, `"Demandez un nouvel e-mail depuis la page de connexion."`, `"Retour à la connexion"`.
es: `"Confirmando tu enlace…"`, `"Este enlace no es válido o ha caducado"`, `"Solicita un nuevo correo desde la página de inicio de sesión."`, `"Volver a iniciar sesión"`.
it: `"Conferma del link in corso…"`, `"Questo link non è valido o è scaduto"`, `"Richiedi una nuova email dalla pagina di accesso."`, `"Torna all'accesso"`.
pt: `"A confirmar o seu link…"`, `"Este link é inválido ou expirou"`, `"Peça um novo e-mail na página de início de sessão."`, `"Voltar ao início de sessão"`.

`app/auth/confirm/page.tsx`:

```tsx
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/lib/supabase/client";
import { isSafeRedirectTarget, routes } from "@/lib/routes";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function ConfirmLink() {
  const t = useTranslations("auth.confirmLink");
  const params = useSearchParams();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // verifyOtp consumes the token: run once
    started.current = true;
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as EmailOtpType | null;
    if (!tokenHash || !type || !OTP_TYPES.includes(type)) {
      setFailed(true);
      return;
    }
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) return setFailed(true);
      const next = params.get("next");
      router.replace(type === "recovery" ? "/auth/reset-password" : isSafeRedirectTarget(next) ? next : "/");
    });
  }, [params, router]);

  if (!failed) {
    return (
      <div className="flex flex-col items-center gap-4 py-16" data-testid="confirm-verifying">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground">{t("verifying")}</p>
      </div>
    );
  }
  return (
    <Card className="max-w-md mx-auto mt-12" data-testid="confirm-invalid">
      <CardHeader>
        <CardTitle>{t("invalidTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("invalidBody")}</p>
        <Link className="underline" href={routes.signIn()}>{t("backToSignIn")}</Link>
      </CardContent>
    </Card>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmLink />
    </Suspense>
  );
}
```

- [ ] **Step 5: Redirect URLs from the web origin**

`components/auth/auth-form.tsx`:
- `resetPasswordForEmail`: `redirectTo: \`${platform.webOrigin()}/auth/reset-password\``.
- `signUp`: add `credentials.options = { data: { lang: locale }, emailRedirectTo: \`${platform.webOrigin()}/\` };`.

(With `token_hash` links, `redirectTo` only supplies the origin and the `next` path; `buildConfirmUrl` drops `/auth/...` paths, and `type=recovery` always goes to `/auth/reset-password`.)

- [ ] **Step 6: E2E for an invalid link**

`tests/e2e/11-auth-confirm.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('an invalid or expired email link shows the expired card', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=not-a-real-token&type=recovery');
  await expect(page.getByTestId('confirm-invalid')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/auth');
});

test('a link without a token shows the expired card', async ({ page }) => {
  await page.goto('/auth/confirm');
  await expect(page.getByTestId('confirm-invalid')).toBeVisible();
});
```

- [ ] **Step 7: Verify**

`pnpm test`, `pnpm i18n:check`, lint gate, `npx tsc --noEmit`, `pnpm build`, start, `npx playwright test --project=core`. Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/send-email app/auth/confirm components/auth messages tests
git commit -m "feat(auth): token_hash email links verified by /auth/confirm on both targets"
```

## Phase E — Locale

### Task 9: Client-side locale

**Files:**
- Create: `lib/i18n/resolve-locale.ts`, `lib/i18n/locale-path.ts`, `tests/unit/i18n/resolve-locale.test.ts`, `components/providers/locale-provider.tsx`, `hooks/use-app-locale.ts`, `tests/e2e/12-locale.spec.ts`
- Modify: `app/layout.tsx`, `next.config.js`, `proxy.web.ts`, `app/settings/page.tsx`, `components/language-switcher.tsx`, `components/auth/auth-form.tsx`, `hooks/use-settings.ts`, `app/api/import/ffvb/route.web.ts`, `public/offline.html`, `tests/e2e/auth.setup.ts`, `eslint.config.mjs` (drop the temporary disables)
- Delete: `lib/i18n/actions.ts`, `lib/i18n/locale.ts`, `i18n.ts`

**Interfaces:**
- Produces:

```ts
// lib/i18n/resolve-locale.ts
export const LOCALE_STORAGE_KEY = "volleystats:locale";
export const LOCALE_ADOPTED_KEY = "volleystats:locale-user";
export function isLocale(value: unknown): value is Locale;
export function browserLocale(languages: readonly string[]): Locale | null;
export function initialLocale(input: { queryLang: string | null; stored: string | null; browser: readonly string[] }): Locale;
export function profileLocaleToAdopt(input: { userId: string | null; adoptedFor: string | null; explicit: boolean; profileLanguage: string | null | undefined; current: Locale }): Locale | null;
// lib/i18n/locale-path.ts
export function splitLocalePrefix(pathname: string): { locale: Locale; path: string } | null;
// components/providers/locale-provider.tsx
export function LocaleProvider({ children }: { children: ReactNode }): JSX.Element;
export function ProfileLocaleSync(): null; // inside AuthProvider
// hooks/use-app-locale.ts
export function useAppLocale(): { locale: Locale; setLocale(locale: Locale): Promise<void> };
```

- [ ] **Step 1: Failing unit tests**

`tests/unit/i18n/resolve-locale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { browserLocale, initialLocale, profileLocaleToAdopt } from "@/lib/i18n/resolve-locale";
import { splitLocalePrefix } from "@/lib/i18n/locale-path";

describe("initialLocale", () => {
  it("prefers ?lang=, then the stored choice, then the browser, then en", () => {
    expect(initialLocale({ queryLang: "fr", stored: "it", browser: ["es-ES"] })).toBe("fr");
    expect(initialLocale({ queryLang: "xx", stored: "it", browser: ["es-ES"] })).toBe("it");
    expect(initialLocale({ queryLang: null, stored: null, browser: ["de-DE", "pt-BR"] })).toBe("pt");
    expect(initialLocale({ queryLang: null, stored: "zz", browser: ["de"] })).toBe("en");
  });
  it("reads two-letter prefixes case-insensitively", () => {
    expect(browserLocale(["FR-ca"])).toBe("fr");
    expect(browserLocale([])).toBeNull();
  });
});

describe("profileLocaleToAdopt", () => {
  const base = { userId: "u1", adoptedFor: null, explicit: false, profileLanguage: "fr", current: "en" as const };
  it("adopts the profile language once per user on this device", () => {
    expect(profileLocaleToAdopt(base)).toBe("fr");
    expect(profileLocaleToAdopt({ ...base, adoptedFor: "u1" })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, adoptedFor: "u0" })).toBe("fr");
  });
  it("never overrides an explicit choice, and ignores unknown or equal languages", () => {
    expect(profileLocaleToAdopt({ ...base, explicit: true })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, profileLanguage: "de" })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, profileLanguage: "en" })).toBeNull();
    expect(profileLocaleToAdopt({ ...base, userId: null })).toBeNull();
  });
});

describe("splitLocalePrefix", () => {
  it("splits /fr/... and leaves other paths alone", () => {
    expect(splitLocalePrefix("/fr/matches")).toEqual({ locale: "fr", path: "/matches" });
    expect(splitLocalePrefix("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(splitLocalePrefix("/matches")).toBeNull();
    expect(splitLocalePrefix("/french")).toBeNull();
  });
});
```

Run — Expected: FAIL (modules missing).

- [ ] **Step 2: Pure modules**

`lib/i18n/resolve-locale.ts`:

```ts
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./config";

export const LOCALE_STORAGE_KEY = "volleystats:locale";
/** Id of the user whose profile language this device already adopted. */
export const LOCALE_ADOPTED_KEY = "volleystats:locale-user";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function browserLocale(languages: readonly string[]): Locale | null {
  for (const language of languages) {
    const short = language.slice(0, 2).toLowerCase();
    if (isLocale(short)) return short;
  }
  return null;
}

/** First match wins: ?lang= (from the /fr/... redirect), the device's saved choice, the browser, English. */
export function initialLocale(input: { queryLang: string | null; stored: string | null; browser: readonly string[] }): Locale {
  if (isLocale(input.queryLang)) return input.queryLang;
  if (isLocale(input.stored)) return input.stored;
  return browserLocale(input.browser) ?? DEFAULT_LOCALE;
}

/**
 * The profile's language is adopted once per signed-in user on this device (their first load here), never
 * over an explicit choice (?lang=). After that the device's choice wins; changing it writes both.
 */
export function profileLocaleToAdopt(input: {
  userId: string | null;
  adoptedFor: string | null;
  explicit: boolean;
  profileLanguage: string | null | undefined;
  current: Locale;
}): Locale | null {
  if (!input.userId || input.adoptedFor === input.userId || input.explicit) return null;
  return isLocale(input.profileLanguage) && input.profileLanguage !== input.current ? input.profileLanguage : null;
}
```

`lib/i18n/locale-path.ts`:

```ts
import type { Locale } from "./config";
import { isLocale } from "./resolve-locale";

/** "/fr/matches" → { locale: "fr", path: "/matches" }; null when the path has no locale prefix. */
export function splitLocalePrefix(pathname: string): { locale: Locale; path: string } | null {
  const match = /^\/([a-z]{2})(\/.*)?$/.exec(pathname);
  if (!match || !isLocale(match[1])) return null;
  return { locale: match[1], path: match[2] || "/" };
}
```

Run the tests — Expected: PASS.

- [ ] **Step 3: Provider and hook**

`components/providers/locale-provider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/auth-context";
import type { Locale } from "@/lib/i18n/config";
import { initialLocale, isLocale, LOCALE_ADOPTED_KEY, LOCALE_STORAGE_KEY, profileLocaleToAdopt } from "@/lib/i18n/resolve-locale";

const LOADERS = {
  en: () => import("@/messages/en"),
  fr: () => import("@/messages/fr"),
  es: () => import("@/messages/es"),
  it: () => import("@/messages/it"),
  pt: () => import("@/messages/pt"),
} satisfies Record<Locale, () => Promise<{ default: unknown }>>;

type Messages = Awaited<ReturnType<(typeof LOADERS)["en"]>>["default"];

interface LocaleContextValue {
  locale: Locale;
  changeLocale(locale: Locale): Promise<void>;
  /** Whether the locale came from ?lang= on this page load. */
  explicit: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ locale: Locale; messages: Messages } | null>(null);
  const explicit = useRef(false);

  const changeLocale = useCallback(async (locale: Locale) => {
    const messages = (await LOADERS[locale]()).default;
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    setState({ locale, messages });
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const queryLang = url.searchParams.get("lang");
    explicit.current = isLocale(queryLang);
    void changeLocale(
      initialLocale({ queryLang, stored: localStorage.getItem(LOCALE_STORAGE_KEY), browser: navigator.languages ?? [navigator.language] })
    );
    if (queryLang !== null) {
      url.searchParams.delete("lang");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [changeLocale]);

  if (!state) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  return (
    <LocaleContext.Provider value={{ locale: state.locale, changeLocale, explicit: explicit.current }}>
      <NextIntlClientProvider locale={state.locale} messages={state.messages} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocaleContext must be used within a LocaleProvider");
  return context;
}

/** Inside AuthProvider: adopts the signed-in user's profile language once on this device. */
export function ProfileLocaleSync(): null {
  const { user } = useAuth();
  const { locale, changeLocale, explicit } = useLocaleContext();
  useEffect(() => {
    if (!user) return;
    const adopt = profileLocaleToAdopt({
      userId: user.id,
      adoptedFor: localStorage.getItem(LOCALE_ADOPTED_KEY),
      explicit,
      profileLanguage: user.profile?.language,
      current: locale,
    });
    localStorage.setItem(LOCALE_ADOPTED_KEY, user.id);
    if (adopt) void changeLocale(adopt);
  }, [user, locale, changeLocale, explicit]);
  return null;
}
```

Check the `User` type in `lib/types.ts` for the id and profile field names (`user.id`, `user.profile?.language` are used by `hooks/use-settings.ts`; if the id lives at `user.profile.id`, use that).

`hooks/use-app-locale.ts`:

```ts
"use client";

import { useCallback } from "react";
import { useLocaleContext } from "@/components/providers/locale-provider";
import { useAuth } from "@/contexts/auth-context";
import { updateProfile } from "@/lib/api/users";
import type { Locale } from "@/lib/i18n/config";

/** The UI language: changes it on this device at once and saves it to the profile when signed in. */
export function useAppLocale() {
  const { locale, changeLocale } = useLocaleContext();
  const { user, setUser } = useAuth();
  const setLocale = useCallback(
    async (next: Locale) => {
      await changeLocale(next);
      if (user?.profile) {
        await updateProfile(user.id, { language: next });
        setUser({ ...user, profile: { ...user.profile, language: next } });
      }
    },
    [changeLocale, user, setUser]
  );
  return { locale, setLocale };
}
```

- [ ] **Step 4: Static layout**

In `app/layout.tsx`: delete the `next-intl/server` import, `getLocale`/`getMessages`, make `RootLayout` a plain (non-async) function, use `<html lang="en" suppressHydrationWarning>`, replace `<NextIntlClientProvider messages={messages} locale={locale}>…</NextIntlClientProvider>` with `<LocaleProvider>…</LocaleProvider>`, and render `<ProfileLocaleSync />` as the first child inside `<AuthProvider>`.

`next.config.js`: delete the `withNextIntl` line and wrapper: `module.exports = isWeb ? withSerwist(nextConfig) : nextConfig;`.

Delete `i18n.ts`, `lib/i18n/actions.ts`, `lib/i18n/locale.ts`. `grep -rn "lib/i18n/locale'\|lib/i18n/locale\"\|i18n/actions" app components hooks lib` must show nothing; imports of `Locale`/`SUPPORTED_LOCALES` move to `@/lib/i18n/config`.

- [ ] **Step 5: Callers**

- `components/language-switcher.tsx`: `const { locale: currentLocale, setLocale } = useAppLocale();` and `handleLanguageChange = (locale) => startTransition(async () => { await setLocale(locale); })` — no path rewriting, no `router.refresh()`.
- `app/settings/page.tsx` `onSubmit`: replace the `updateLocale` block with `if (values.language !== settings.language) await setLocale(values.language as Locale);` (from `useAppLocale()`), and delete the trailing `router.refresh()` block.
- `components/auth/auth-form.tsx`: delete `syncLocaleFromProfile` (ProfileLocaleSync adopts it) and the `router.refresh()` after sign-in.
- `hooks/use-settings.ts`: keep `useLocale()` from `next-intl` (still provided).
- `app/api/import/ffvb/route.web.ts`:

```ts
import { createTranslator } from "next-intl";
import messages from "@/messages/en";
// ...
const t = createTranslator({ locale: "en", messages, namespace: "common" });
```

- `public/offline.html`: replace the cookie lookup with `var saved = null; try { saved = localStorage.getItem("volleystats:locale"); } catch (e) {}` and `var locale = saved && TEXTS[saved] ? saved : TEXTS[browser] ? browser : "en";`.

- [ ] **Step 6: Proxy turns `/fr/...` into `?lang=fr`**

`proxy.web.ts`:

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/server/session';
import { splitLocalePrefix } from '@/lib/i18n/locale-path';

export async function proxy(req: NextRequest) {
  // /fr/matches → /matches?lang=fr: the client picks up the language and saves it on the device.
  const prefixed = splitLocalePrefix(req.nextUrl.pathname);
  if (prefixed) {
    const url = req.nextUrl.clone();
    url.pathname = prefixed.path;
    url.searchParams.set('lang', prefixed.locale);
    return NextResponse.redirect(url, 307);
  }
  return updateSession(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|serwist|offline\\.html|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 7: E2E setup and locale spec**

`tests/e2e/auth.setup.ts`: replace the `/en/` block with

```ts
  // English UI for every spec: an explicit ?lang= is saved on this device and is never replaced by the profile language.
  await page.goto('/?lang=en');
  await expect(page).toHaveURL((url) => !url.searchParams.has('lang'));
  await page.context().storageState({ path: authFile });
```

`tests/e2e/12-locale.spec.ts` (core project):

```ts
import { test, expect } from '@playwright/test';

test('a /fr/ link shows French and ends on a clean URL @web', async ({ page }) => {
  await page.goto('/fr/teams');
  await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/teams' && !url.searchParams.has('lang'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Équipes');
  // Back to English for the specs that follow in this browser state.
  await page.goto('/?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the language switcher changes the language without a reload', async ({ page }) => {
  await page.goto('/teams');
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: /Français/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await page.getByRole('button', { name: /langue|language/i }).click();
  await page.getByRole('menuitem', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
```

Check the French heading of the teams page in `messages/fr/teams.json` and the switcher's aria-label (`common.ui.changeLanguage` in en/fr) and adjust the two strings to them. The second test writes the profile language (English at the end).

- [ ] **Step 8: Verify**

Remove the temporary `eslint-disable` lines added in Task 5. `pnpm test`, `pnpm i18n:check`, lint gate, `npx tsc --noEmit`, `pnpm build`, start, `pnpm test:e2e:quick` and `--project=core -g "locale|language"`. Expected: pass. Then `pnpm build:mobile` — Expected: it now gets past the layout; remaining failures (if any) must be listed in the task report for Task 10.

- [ ] **Step 9: Commit**

```bash
git add -A app components hooks lib next.config.js proxy.web.ts public/offline.html tests i18n.ts eslint.config.mjs
git commit -m "feat(i18n): client-side locale on both targets; /fr/ links redirect to ?lang="
```

## Phase F — The export

### Task 10: The export builds, is checked, and runs in a browser

**Files:**
- Create: `scripts/lib/export-check.mjs`, `scripts/check-export.mjs`, `scripts/serve-export.mjs`, `tests/unit/build/export-check.test.ts`, `lib/server/cors.ts`, `tests/unit/server/cors.test.ts`
- Modify: `app/api/v1/matches/[id]/report/route.web.ts`, `app/championships/view/page.tsx`, `package.json`, `playwright.config.ts`, `.env.example`

**Interfaces:**
- Produces:

```js
// scripts/lib/export-check.mjs
export const EXPECTED_PAGES: string[];
export function missingPages(outDir, pages = EXPECTED_PAGES): string[];
export function forbiddenPaths(relativeFiles: string[]): string[];
export function findSecrets(text: string, options?: { serviceKey?: string }): string[];
```

```ts
// lib/server/cors.ts
export function allowedOrigins(value?: string): string[];
export function corsHeaders(origin: string | null, allowed?: string[]): Record<string, string>;
export function withCors(request: Request, response: Response): Response;
export function preflight(request: Request): Response;
```

- [ ] **Step 1: Failing tests for the export check**

`tests/unit/build/export-check.test.ts`:

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findSecrets, forbiddenPaths, missingPages } from "../../../scripts/lib/export-check.mjs";

const jwt = (payload: object) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(payload)).toString("base64url"), "c2lnbmF0dXJlc2lnbmF0dXJl"].join(".");

describe("export check", () => {
  it("lists pages without an index.html", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "out-"));
    fs.mkdirSync(path.join(dir, "teams"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), "");
    fs.writeFileSync(path.join(dir, "teams", "index.html"), "");
    expect(missingPages(dir, ["/", "/teams", "/matches/live"])).toEqual(["/matches/live"]);
  });
  it("flags dynamic segments, the service worker and API routes", () => {
    expect(forbiddenPaths(["matches/[id]/live/index.html", "serwist/sw.js", "sw.js", "api/v1/x", "teams/index.html"])).toEqual([
      "matches/[id]/live/index.html", "serwist/sw.js", "sw.js", "api/v1/x",
    ]);
  });
  it("finds service-role JWTs and secret keys, not anon keys or the bare word", () => {
    const service = jwt({ role: "service_role", iss: "supabase" });
    const anon = jwt({ role: "anon", iss: "supabase" });
    expect(findSecrets(`a ${service} b`)).toHaveLength(1);
    expect(findSecrets(`a ${anon} b role:"service_role"`)).toEqual([]);
    expect(findSecrets("x sb_secret_abcdefghijklmnop y")).toHaveLength(1);
    expect(findSecrets("x my-actual-key y", { serviceKey: "my-actual-key" })).toHaveLength(1);
  });
});
```

Run — Expected: FAIL (module missing).

- [ ] **Step 2: Export check library and CLI**

`scripts/lib/export-check.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

export const EXPECTED_PAGES = [
  '/', '/auth', '/auth/confirm', '/auth/reset-password', '/matches', '/matches/live', '/matches/score',
  '/matches/stats', '/teams', '/teams/new', '/teams/view', '/teams/players', '/championships',
  '/championships/view', '/settings',
];

export function missingPages(outDir, pages = EXPECTED_PAGES) {
  return pages.filter((page) => !fs.existsSync(path.join(outDir, page, 'index.html')));
}

export function forbiddenPaths(relativeFiles) {
  return relativeFiles.filter((file) => {
    const f = file.replaceAll('\\', '/');
    return f.split('/').some((segment) => segment.startsWith('[')) || f.startsWith('serwist/') || f === 'sw.js' || f.startsWith('api/');
  });
}

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{10,}/g;

/** Labels of secrets found in `text` (never the secret itself). */
export function findSecrets(text, { serviceKey } = {}) {
  const found = [];
  for (const match of text.matchAll(JWT)) {
    try {
      if (JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')).role === 'service_role') found.push('service_role JWT');
    } catch {
      // Not a JWT payload.
    }
  }
  for (const _ of text.matchAll(SECRET_KEY)) found.push('sb_secret_ key');
  if (serviceKey && text.includes(serviceKey)) found.push('SUPABASE_SERVICE_ROLE_KEY value');
  return found;
}

export function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}
```

`scripts/check-export.mjs`:

```js
#!/usr/bin/env node
// Checks the static export in out/ (or the given folder): every page has an index.html, no server-only
// files, and no secret in any file. Prints file names and labels only, never secret values.
import fs from 'node:fs';
import path from 'node:path';
import { findSecrets, forbiddenPaths, listFiles, missingPages } from './lib/export-check.mjs';

const outDir = path.resolve(process.argv[2] ?? 'out');
if (!fs.existsSync(outDir)) {
  console.error(`No export at ${outDir}: run pnpm build:mobile first.`);
  process.exit(1);
}
const problems = [];
for (const page of missingPages(outDir)) problems.push(`missing page: ${page}/index.html`);
const files = listFiles(outDir);
for (const file of forbiddenPaths(files)) problems.push(`server-only file in the export: ${file}`);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
for (const file of files.filter((f) => /\.(html|js|json|txt|css|map)$/.test(f))) {
  for (const label of findSecrets(fs.readFileSync(path.join(outDir, file), 'utf8'), { serviceKey })) problems.push(`${label} in ${file}`);
}
if (problems.length) {
  console.error('Export check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`Export check passed: ${files.length} files in ${outDir}.`);
```

Run the unit test — Expected: PASS.

- [ ] **Step 3: Static server for e2e**

`scripts/serve-export.mjs`:

```js
#!/usr/bin/env node
// Serves the static export like the Capacitor shell will: a path is a file, or a folder's index.html.
// Usage: node scripts/serve-export.mjs [dir=out] [port=3200]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'out');
const port = Number(process.argv[3] ?? 3200);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function resolveFile(urlPath) {
  const file = path.join(root, decodeURIComponent(urlPath.split('?')[0]));
  if (!file.startsWith(root)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const index = path.join(file, 'index.html');
  return fs.existsSync(index) ? index : null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url ?? '/');
    if (!file) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      fs.createReadStream(path.join(root, '404.html')).on('error', () => res.end()).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
```

`package.json` scripts: `"check:export": "node scripts/check-export.mjs"`, `"serve:mobile": "node scripts/serve-export.mjs out 3200"`.

- [ ] **Step 4: CORS helper (failing test first)**

`tests/unit/server/cors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allowedOrigins, corsHeaders, preflight, withCors } from "@/lib/server/cors";

describe("cors", () => {
  const allowed = ["http://localhost:3200", "capacitor://localhost"];
  it("parses the allowlist", () => {
    expect(allowedOrigins(" http://localhost:3200 , capacitor://localhost,")).toEqual(allowed);
    expect(allowedOrigins(undefined)).toEqual([]);
  });
  it("answers allowed origins only, always varying on Origin", () => {
    expect(corsHeaders("http://localhost:3200", allowed)).toMatchObject({
      "Access-Control-Allow-Origin": "http://localhost:3200",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
      "Access-Control-Expose-Headers": "ETag, Content-Disposition",
      Vary: "Origin",
    });
    expect(corsHeaders("https://evil.example", allowed)).toEqual({ Vary: "Origin" });
    expect(corsHeaders(null, allowed)).toEqual({ Vary: "Origin" });
  });
  it("adds the headers to responses and preflights", () => {
    process.env.API_CORS_ORIGINS = "http://localhost:3200";
    const request = new Request("http://localhost:3100/api/v1/x", { headers: { origin: "http://localhost:3200" } });
    expect(withCors(request, Response.json({ ok: true })).headers.get("access-control-allow-origin")).toBe("http://localhost:3200");
    const answer = preflight(request);
    expect(answer.status).toBe(204);
    expect(answer.headers.get("access-control-allow-methods")).toBe("GET, POST, DELETE, OPTIONS");
  });
});
```

`lib/server/cors.ts`:

```ts
/** CORS for /api/v1: the static export (another origin) calls the web deployment with a Bearer token, no cookies. */
const METHODS = "GET, POST, DELETE, OPTIONS";
const HEADERS = "Authorization, Content-Type, If-None-Match";
const EXPOSED = "ETag, Content-Disposition";

export function allowedOrigins(value: string | undefined = process.env.API_CORS_ORIGINS): string[] {
  return (value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function corsHeaders(origin: string | null, allowed: string[] = allowedOrigins()): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": METHODS,
    "Access-Control-Allow-Headers": HEADERS,
    "Access-Control-Expose-Headers": EXPOSED,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function withCors(request: Request, response: Response): Response {
  for (const [name, value] of Object.entries(corsHeaders(request.headers.get("origin")))) response.headers.set(name, value);
  return response;
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}
```

Run — Expected: PASS.

In `app/api/v1/matches/[id]/report/route.web.ts`: rename the handler body to `async function handle(request, context)` and export

```ts
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withCors(request, await handle(request, context));
}

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}
```

Add `API_CORS_ORIGINS=` with a comment to `.env.example` ("Comma-separated origins allowed to call /api/v1 (e2e export: http://localhost:3200; the app: capacitor://localhost,https://localhost)").

- [ ] **Step 5: FFVB import hidden in the mobile build**

In `app/championships/view/page.tsx`, render the refresh/import button only when `platform.target === "web"` (import `platform` from `@/lib/platform`; wrap the button's JSX in `{platform.target === "web" && (…)}`).

- [ ] **Step 6: Build the export and check it**

Add to `.env.local` (your local file, not committed) `NEXT_PUBLIC_API_ORIGIN=http://localhost:3100` and `NEXT_PUBLIC_WEB_ORIGIN=http://localhost:3100` if absent; add both names to `.env.example` with empty values and a comment.
Run: `pnpm build:mobile` — Expected: succeeds. If it fails, fix each error at its cause (typical: a `useSearchParams` without `<Suspense>` — wrap it as in Task 6 Step 5; a server-only import reached from a page — the ESLint rule should have caught it, move the code to a `.web.ts` file). Do not add `generateStaticParams` or `dynamic` exports.
Run: `pnpm check:export` — Expected: "Export check passed".

- [ ] **Step 7: Run e2e against the export**

In `playwright.config.ts`, nothing changes except what Task 2 added (`grepInvert` for `E2E_TARGET=mobile`). Tag the web-only tests: `05b-sw-cache` (Task 3), `09-routes` first test, `12-locale` first test already carry `@web`; `00-public-access` (service worker script) gets ` @web` in its title.
Start the web server with CORS: `API_CORS_ORIGINS=http://localhost:3200 pnpm start -p 3100` (background), and `pnpm serve:mobile` (background).
Run: `CI=1 BASE_URL=http://localhost:3200 E2E_TARGET=mobile npx playwright test --project=core --project=live`
Expected: pass. Then `--project=stats` (PDF export through CORS). Expected: pass. Stop both servers.

- [ ] **Step 8: Web still fine**

`pnpm build`, start, `pnpm test:e2e:quick`. Expected: pass. `pnpm test`, lint gate, `npx tsc --noEmit`.

- [ ] **Step 9: Commit**

```bash
git add scripts lib/server/cors.ts app package.json playwright.config.ts .env.example tests
git commit -m "feat(export): static export builds and is checked; /api/v1 CORS; e2e on the export"
```

## Phase G — Account deletion

### Task 11: Inspect the live constraints and policies (read-only)

**Files:**
- Create: `docs/superpowers/notes/2026-10-15-user-fk-audit.md`

- [ ] **Step 1: Read the foreign keys on user columns**

With the Supabase MCP `execute_sql` (read-only):

```sql
select tc.table_name, kcu.column_name, rc.delete_rule, tc.constraint_name,
       (select is_nullable from information_schema.columns c
         where c.table_schema = 'public' and c.table_name = tc.table_name and c.column_name = kcu.column_name) as is_nullable
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
  and ccu.table_schema = 'auth' and ccu.table_name = 'users'
order by tc.table_name, kcu.column_name;
```

- [ ] **Step 2: Read the policies and triggers that use user columns**

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual ilike '%user_id%' or with_check ilike '%user_id%')
order by tablename, policyname;

select event_object_table as table_name, trigger_name, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
```

- [ ] **Step 3: Write the audit note**

In `docs/superpowers/notes/2026-10-15-user-fk-audit.md`, record: each FK (table, column, current delete rule, nullable), and each policy whose condition uses `clubs.user_id`, `teams.user_id` or `championships.user_id` (the creator columns) — quote the condition. For each such policy, write one line: what a club owner (through `club_members`) can still do once the creator column is `null`. Also note the trigger that adds the creator as owner of a new team/club (name and statement), if any. No secret values: the queries return schema only.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/notes/2026-10-15-user-fk-audit.md
git commit -m "docs: audit of user foreign keys and policies before account deletion"
```

### Task 12: Migration: user foreign keys and `delete_my_account()`

> **Revised 2026-10-15:** after the live audit (Task 11) and the user's decision, account deletion asks the leaving user to hand over or delete each team they created (spec §5, revised). The SQL and steps below are superseded by that design; the controller's revised briefs carry the new migration and UI.

**Files:**
- Create: `supabase/migrations/20261015000000_account_deletion.sql`
- Modify: `lib/supabase/database.types.ts` (Functions: `delete_my_account`)

**Interfaces:**
- Produces: RPC `delete_my_account()` returning `void`; raises `sole_club_owner` (SQLSTATE `P0001`, `detail` = JSON array of club names).

- [ ] **Step 1: Write the migration from the audit**

`supabase/migrations/20261015000000_account_deletion.sql` — adapt each `alter table` to the constraint names and rules found in Task 11 (drop and re-add only those not already right):

```sql
-- Account deletion (stores require it in-app): deleting a user removes the person — auth user, profile,
-- memberships — and keeps the team data (players, matches, stats). Spec: 2026-10-14-static-export-readiness-design.md §5.

-- Creator columns: set null instead of blocking the delete.
alter table public.clubs alter column user_id drop not null;
alter table public.clubs drop constraint if exists clubs_user_id_fkey,
  add constraint clubs_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.teams alter column user_id drop not null;
alter table public.teams drop constraint if exists teams_user_id_fkey,
  add constraint teams_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

alter table public.championships alter column user_id drop not null;
alter table public.championships drop constraint if exists championships_user_id_fkey,
  add constraint championships_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- A player row linked to the account stays, unlinked.
alter table public.team_members drop constraint if exists team_members_user_id_fkey,
  add constraint team_members_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- Memberships and the profile go with the account.
alter table public.club_members drop constraint if exists club_members_user_id_fkey,
  add constraint club_members_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.profiles drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- matches.scorer_user_id is already "on delete set null" (20261007000000_sync_reliability.sql).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  owned text[];
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Clubs where the caller is the only owner would be left without one.
  select coalesce(array_agg(c.name order by c.name), '{}')
    into owned
  from public.clubs c
  where c._deleted = false
    and exists (select 1 from public.club_members m
                where m.club_id = c.id and m.user_id = caller and m.role = 'owner' and m._deleted = false)
    and not exists (select 1 from public.club_members m
                    where m.club_id = c.id and m.user_id <> caller and m.role = 'owner' and m._deleted = false);
  if array_length(owned, 1) > 0 then
    raise exception 'sole_club_owner' using errcode = 'P0001', detail = to_json(owned)::text;
  end if;

  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
```

If the audit showed policies granting rights only through a creator column, add the adjusted policies to this file (each with a comment saying which audit line it answers). If the audit shows a `profiles` FK name other than `profiles_id_fkey`, use it.

- [ ] **Step 2: Ask the user, then apply**

Ask: "Task 12 changes foreign keys on clubs, teams, championships, team_members, club_members and profiles (deletes now null the creator / unlink the player instead of failing) and adds `delete_my_account()`. Old app versions are unaffected. Apply to the shared Supabase project now?" Only after a yes, apply with the Supabase MCP `apply_migration` (name `account_deletion`, the SQL above).

- [ ] **Step 3: Verify on the server (read-only plus a rolled-back test)**

Re-run the Task 11 Step 1 query. Expected: the rules in the spec table. Then, in one `execute_sql` call that rolls back:

```sql
begin;
-- A throwaway user owning nothing alone, creator of a team with a player row linked to them.
insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-00000000d1e7', 'e2e-fk-check@example.com', 'authenticated', 'authenticated');
insert into public.teams (id, name, user_id, status) values ('00000000-0000-4000-8000-00000000d1e8', 'E2E Team fk-check', '00000000-0000-4000-8000-00000000d1e7', 'active');
insert into public.team_members (team_id, name, role, user_id) values ('00000000-0000-4000-8000-00000000d1e8', 'Linked Player', 'player', '00000000-0000-4000-8000-00000000d1e7');
delete from auth.users where id = '00000000-0000-4000-8000-00000000d1e7';
select (select user_id from public.teams where id = '00000000-0000-4000-8000-00000000d1e8') as team_creator_after,
       (select count(*) from public.team_members where team_id = '00000000-0000-4000-8000-00000000d1e8' and user_id is null) as unlinked_players;
rollback;
```

Expected: `team_creator_after` null, `unlinked_players` ≥ 1 (a trigger may also have added an owner row, which is unlinked too). If an insert fails on a column this SQL doesn't set, add that column with a valid value and re-run.

- [ ] **Step 4: Types**

Run `pnpm supabase:types`. If the CLI isn't logged in, use the Supabase MCP `generate_typescript_types` and write its output to `lib/supabase/database.types.ts`; or add by hand under `Functions`: `delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined }`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261015000000_account_deletion.sql lib/supabase/database.types.ts
git commit -m "feat(db): deleting a user keeps team data; delete_my_account() refuses sole club owners"
```

### Task 13: Account deletion in settings

> **Revised 2026-10-15:** after the live audit (Task 11) and the user's decision, account deletion asks the leaving user to hand over or delete each team they created (spec §5, revised). The SQL and steps below are superseded by that design; the controller's revised briefs carry the new migration and UI.

**Files:**
- Create: `components/settings/delete-account-card.tsx`, `lib/auth/delete-account.ts`, `tests/unit/auth/delete-account.test.ts`, `tests/helpers/throwaway-user.ts`, `tests/e2e/13-account-deletion.spec.ts`
- Modify: `app/settings/page.tsx`, `app/auth/page.tsx`, `messages/*/settings.json`, `messages/*/auth.json`, `tests/global-teardown.ts`

**Interfaces:**
- Produces:

```ts
// lib/auth/delete-account.ts
export type DeleteAccountResult = { ok: true } | { ok: false; reason: "sole_club_owner"; clubs: string[] } | { ok: false; reason: "failed"; message: string };
export function parseDeleteAccountError(error: { message?: string; details?: string | null } | null): DeleteAccountResult;
// tests/helpers/throwaway-user.ts
export async function createThrowawayUser(): Promise<{ id: string; email: string; password: string }>;
export async function deleteThrowawayUsers(): Promise<number>;
```

- [ ] **Step 1: Failing unit test for the error parsing**

`tests/unit/auth/delete-account.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDeleteAccountError } from "@/lib/auth/delete-account";

describe("parseDeleteAccountError", () => {
  it("succeeds without an error", () => {
    expect(parseDeleteAccountError(null)).toEqual({ ok: true });
  });
  it("lists the clubs of a sole owner", () => {
    expect(parseDeleteAccountError({ message: "sole_club_owner", details: '["Club A","Club B"]' })).toEqual({
      ok: false, reason: "sole_club_owner", clubs: ["Club A", "Club B"],
    });
  });
  it("treats unreadable details and other errors as failures", () => {
    expect(parseDeleteAccountError({ message: "sole_club_owner", details: "oops" })).toEqual({ ok: false, reason: "sole_club_owner", clubs: [] });
    expect(parseDeleteAccountError({ message: "boom", details: null })).toEqual({ ok: false, reason: "failed", message: "boom" });
  });
});
```

Run — Expected: FAIL.

`lib/auth/delete-account.ts`:

```ts
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: "sole_club_owner"; clubs: string[] }
  | { ok: false; reason: "failed"; message: string };

/** Reads the answer of the delete_my_account() RPC. */
export function parseDeleteAccountError(error: { message?: string; details?: string | null } | null): DeleteAccountResult {
  if (!error) return { ok: true };
  if (error.message === "sole_club_owner") {
    let clubs: string[] = [];
    try {
      const parsed = JSON.parse(error.details ?? "[]");
      if (Array.isArray(parsed)) clubs = parsed.map(String);
    } catch {
      // Club names unreadable: still a sole-owner refusal.
    }
    return { ok: false, reason: "sole_club_owner", clubs };
  }
  return { ok: false, reason: "failed", message: error.message ?? "unknown" };
}
```

Run — Expected: PASS.

- [ ] **Step 2: Strings (five locales)**

`messages/en/settings.json` — add a top-level `deleteAccount`:

```json
"deleteAccount": {
  "title": "Delete account",
  "description": "Permanently delete your account. Players, matches and statistics stay with their teams.",
  "button": "Delete account",
  "unsentBlocked": "Wait until your changes are uploaded before deleting your account.",
  "dialogTitle": "Delete your account?",
  "deleted": "Deleted: your sign-in, your profile, your club and team memberships.",
  "kept": "Kept: the players, matches and statistics of your teams.",
  "confirmLabel": "Type your email to confirm",
  "confirm": "Delete my account",
  "cancel": "Cancel",
  "soleOwner": "You are the only owner of these clubs. Make another member owner, or delete the club, first:",
  "failed": "Your account could not be deleted. Try again."
}
```

fr:
```json
"deleteAccount": {
  "title": "Supprimer le compte",
  "description": "Supprime définitivement votre compte. Les joueurs, matchs et statistiques restent dans leurs équipes.",
  "button": "Supprimer le compte",
  "unsentBlocked": "Attendez que vos modifications soient envoyées avant de supprimer votre compte.",
  "dialogTitle": "Supprimer votre compte ?",
  "deleted": "Supprimé : votre connexion, votre profil, vos adhésions aux clubs et équipes.",
  "kept": "Conservé : les joueurs, matchs et statistiques de vos équipes.",
  "confirmLabel": "Saisissez votre e-mail pour confirmer",
  "confirm": "Supprimer mon compte",
  "cancel": "Annuler",
  "soleOwner": "Vous êtes le seul propriétaire de ces clubs. Nommez un autre membre propriétaire, ou supprimez le club, d'abord :",
  "failed": "Votre compte n'a pas pu être supprimé. Réessayez."
}
```

es:
```json
"deleteAccount": {
  "title": "Eliminar cuenta",
  "description": "Elimina tu cuenta de forma permanente. Los jugadores, partidos y estadísticas se quedan en sus equipos.",
  "button": "Eliminar cuenta",
  "unsentBlocked": "Espera a que se envíen tus cambios antes de eliminar tu cuenta.",
  "dialogTitle": "¿Eliminar tu cuenta?",
  "deleted": "Se elimina: tu acceso, tu perfil, tus membresías de clubes y equipos.",
  "kept": "Se conserva: los jugadores, partidos y estadísticas de tus equipos.",
  "confirmLabel": "Escribe tu correo para confirmar",
  "confirm": "Eliminar mi cuenta",
  "cancel": "Cancelar",
  "soleOwner": "Eres el único propietario de estos clubes. Nombra propietario a otro miembro, o elimina el club, primero:",
  "failed": "No se pudo eliminar tu cuenta. Inténtalo de nuevo."
}
```

it:
```json
"deleteAccount": {
  "title": "Elimina account",
  "description": "Elimina definitivamente il tuo account. Giocatori, partite e statistiche restano nelle loro squadre.",
  "button": "Elimina account",
  "unsentBlocked": "Attendi che le modifiche siano inviate prima di eliminare l'account.",
  "dialogTitle": "Eliminare il tuo account?",
  "deleted": "Eliminati: il tuo accesso, il tuo profilo, le iscrizioni a club e squadre.",
  "kept": "Conservati: giocatori, partite e statistiche delle tue squadre.",
  "confirmLabel": "Scrivi la tua email per confermare",
  "confirm": "Elimina il mio account",
  "cancel": "Annulla",
  "soleOwner": "Sei l'unico proprietario di questi club. Nomina proprietario un altro membro, o elimina il club, prima:",
  "failed": "Impossibile eliminare l'account. Riprova."
}
```

pt:
```json
"deleteAccount": {
  "title": "Eliminar conta",
  "description": "Elimina a sua conta de forma permanente. Jogadores, jogos e estatísticas ficam nas suas equipas.",
  "button": "Eliminar conta",
  "unsentBlocked": "Aguarde até as suas alterações serem enviadas antes de eliminar a conta.",
  "dialogTitle": "Eliminar a sua conta?",
  "deleted": "Eliminado: o seu acesso, o seu perfil, as suas associações a clubes e equipas.",
  "kept": "Mantido: os jogadores, jogos e estatísticas das suas equipas.",
  "confirmLabel": "Escreva o seu e-mail para confirmar",
  "confirm": "Eliminar a minha conta",
  "cancel": "Cancelar",
  "soleOwner": "É o único proprietário destes clubes. Nomeie outro membro proprietário, ou elimine o clube, primeiro:",
  "failed": "Não foi possível eliminar a conta. Tente novamente."
}
```

`messages/*/auth.json` add `"accountDeleted"`: en "Your account has been deleted.", fr "Votre compte a été supprimé.", es "Tu cuenta ha sido eliminada.", it "Il tuo account è stato eliminato.", pt "A sua conta foi eliminada."

- [ ] **Step 3: The card**

`components/settings/delete-account-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearCachedUser } from "@/lib/auth/user-cache";
import { parseDeleteAccountError, type DeleteAccountResult } from "@/lib/auth/delete-account";
import { LOCALE_ADOPTED_KEY, LOCALE_STORAGE_KEY } from "@/lib/i18n/resolve-locale";
import { supabase } from "@/lib/supabase/client";

export function DeleteAccountCard({ email, unsentChanges }: { email: string; unsentChanges: number }) {
  const t = useTranslations("settings.deleteAccount");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeleteAccountResult | null>(null);
  const blocked = unsentChanges > 0;

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_my_account");
    const outcome = parseDeleteAccountError(error);
    if (!outcome.ok) {
      setResult(outcome);
      setBusy(false);
      return;
    }
    // The account is gone: drop this device's session, profile copy and language choice, then reopen the app
    // with the local database removed (nothing is unsent: the button was disabled otherwise).
    clearCachedUser();
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    localStorage.removeItem(LOCALE_ADOPTED_KEY);
    window.location.assign(new URL("/auth?account-deleted=1&remove-database=true", window.location.origin).href);
  };

  return (
    <Card data-testid="delete-account-card">
      <CardContent className="p-6 space-y-3">
        <Label>{t("title")}</Label>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        {blocked && <p className="text-sm text-destructive" data-testid="delete-account-blocked">{t("unsentBlocked")}</p>}
        <Button type="button" variant="destructive" disabled={blocked} onClick={() => { setTyped(""); setResult(null); setOpen(true); }}>
          {t("button")}
        </Button>
      </CardContent>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{t("deleted")}</p>
                <p>{t("kept")}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {result && !result.ok && (
            <div className="text-sm text-destructive" data-testid="delete-account-error">
              {result.reason === "sole_club_owner" ? (
                <>
                  <p>{t("soleOwner")}</p>
                  <ul className="list-disc pl-5">{result.clubs.map((club) => <li key={club}>{club}</li>)}</ul>
                </>
              ) : (
                <p>{t("failed")}</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="delete-account-email">{t("confirmLabel")}</Label>
            <Input id="delete-account-email" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase()} onClick={() => void remove()}>
              {t("confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

In `app/settings/page.tsx`, render at the bottom of the page (after the local database card):

```tsx
{session?.user?.email && (
  // Until the local database is open the unsent count is unknown: keep the button disabled.
  <DeleteAccountCard email={session.user.email} unsentChanges={db ? (unsentMatchData ?? 0) : 1} />
)}
```

(`session`, `db` and `unsentMatchData` are already in scope in `app/settings/page.tsx`: `pendingEmail = session?.user?.new_email` and the local-data card use them.)

In `app/auth/page.tsx`, show above the card when `searchParams.get("account-deleted") === "1"`:

```tsx
<Alert className="mb-4" data-testid="account-deleted"><AlertDescription>{t("accountDeleted")}</AlertDescription></Alert>
```

(`Alert`, `AlertDescription` from `@/components/ui/alert`.)

- [ ] **Step 4: Throwaway users for the e2e**

`tests/helpers/throwaway-user.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export const THROWAWAY_PREFIX = 'e2e-delete-';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Account-deletion e2e needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (local .env.local)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A confirmed user that exists only for one test. The password is random and never printed. */
export async function createThrowawayUser() {
  const email = `${THROWAWAY_PREFIX}${Date.now()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`throwaway user: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Removes throwaway users a failed run left behind. */
export async function deleteThrowawayUsers(): Promise<number> {
  const client = admin();
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`list users: ${error.message}`);
  const leftovers = data.users.filter((u) => u.email?.startsWith(THROWAWAY_PREFIX));
  for (const user of leftovers) await client.auth.admin.deleteUser(user.id);
  return leftovers.length;
}
```

In `tests/global-teardown.ts`, after the existing cleanup: `if (process.env.SUPABASE_SERVICE_ROLE_KEY) console.log(\`e2e cleanup: ${await deleteThrowawayUsers()} throwaway users\`);`.

- [ ] **Step 5: E2E spec**

`tests/e2e/13-account-deletion.spec.ts` (core project):

```ts
import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createThrowawayUser } from '../helpers/throwaway-user';

test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth?lang=en');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
}

test('a user deletes their account; signing in again fails', async ({ page }) => {
  const user = await createThrowawayUser();
  await signIn(page, user.email, user.password);
  await page.goto('/settings');
  await page.getByTestId('delete-account-card').getByRole('button', { name: 'Delete account' }).click();
  const confirm = page.getByRole('button', { name: 'Delete my account' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Type your email to confirm').fill(user.email);
  await confirm.click();
  await expect(page.getByTestId('account-deleted')).toBeVisible({ timeout: 30_000 });

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  expect(error).not.toBeNull();
});

test('the only owner of a club cannot delete their account', async ({ page }) => {
  const user = await createThrowawayUser();
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: user.email, password: user.password });
  const clubName = `E2E Club ${Date.now()}`;
  const clubId = crypto.randomUUID();
  const { error: clubError } = await client.from('clubs').insert({ id: clubId, name: clubName, user_id: user.id });
  expect(clubError).toBeNull();
  // The audit (Task 11) says whether a trigger makes the creator owner; if not, insert the membership here.
  const { data: owners } = await client.from('club_members').select('id').eq('club_id', clubId).eq('role', 'owner');
  if (!owners?.length) await client.from('club_members').insert({ club_id: clubId, user_id: user.id, role: 'owner' });

  await signIn(page, user.email, user.password);
  await page.goto('/settings');
  await page.getByTestId('delete-account-card').getByRole('button', { name: 'Delete account' }).click();
  await page.getByLabel('Type your email to confirm').fill(user.email);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByTestId('delete-account-error')).toContainText(clubName);
  await expect(page).toHaveURL(/\/settings/);
});
```

The second test's user and club are removed by teardown: the throwaway user is deleted by `deleteThrowawayUsers` — but a sole-owner user can't be deleted while owning the club only through the RPC; the admin `deleteUser` bypasses the RPC check, and the club stays with a null creator. Add `E2E Club %` to the cleanup patterns in `tests/helpers/e2e-cleanup.ts` the same way as `E2E Championship %` (service role, clubs only).

- [ ] **Step 6: Verify**

`pnpm test`, `pnpm i18n:check`, lint gate, `npx tsc --noEmit`, `pnpm build`, start, `npx playwright test --project=core -g "account"`. Expected: pass. Then the export: build/serve as in Task 10 Step 7 and run the same grep with `E2E_TARGET=mobile` against 3200. Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add components/settings lib/auth app/settings app/auth messages tests
git commit -m "feat(settings): delete account in the app; blocked while changes are unsent or as a club's sole owner"
```

## Phase H — CI, docs, final verification

### Task 14: GitHub Actions, documentation, full verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md`, `.claude/docs/02-architecture.md`, `.claude/docs/03-code-patterns.md`, `.claude/docs/06-auth.md`, `.claude/docs/07-features.md`, `docs/superpowers/specs/2026-10-14-static-export-readiness-design.md` (status line)

- [ ] **Step 1: Workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    env:
      # Public values only (GitHub Actions variables). No secret is needed to lint, test or build.
      NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      NEXT_PUBLIC_API_ORIGIN: ${{ vars.NEXT_PUBLIC_API_ORIGIN }}
      NEXT_PUBLIC_WEB_ORIGIN: ${{ vars.NEXT_PUBLIC_WEB_ORIGIN }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Lint (no new errors compared with the baseline)
        run: |
          node scripts/lint-report.mjs
          node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json
      - run: pnpm test
      - name: Web build
        run: pnpm build
      - name: Mobile export
        run: pnpm build:mobile
      - name: Export check
        run: pnpm check:export
```

`pnpm/action-setup@v4` reads `packageManager` from `package.json`. Ask the user to create the four repository **variables** (Settings → Secrets and variables → Actions → Variables) with the public values; do not create them yourself and do not paste values into chat or files.

- [ ] **Step 2: Run the workflow's commands locally**

Run each `run:` line in order. Expected: all succeed.

- [ ] **Step 3: Documentation**

- `CLAUDE.md`: in **Key Characteristics** add "Two build targets: `web` (Vercel: proxy, `/api` routes, service worker) and `mobile` (`BUILD_TARGET=mobile`, static export in `out/` for the Capacitor app)". In **Common Commands** add `pnpm build:mobile`, `pnpm check:export`, `pnpm serve:mobile`. In **Essential Patterns** add: "5. **Two targets**: server-only files are `*.web.ts(x)` (or in `lib/server/`); target-specific code lives behind `lib/platform`; in-app URLs come from `lib/routes.ts` (ids as `?id=`); the API is called with `apiFetch`."
- `.claude/docs/02-architecture.md`: a "Build targets" section (the table from spec §1), `lib/platform`, `lib/server`, ESLint boundaries.
- `.claude/docs/03-code-patterns.md`: `routes.*` and `useRouteId` + `<Suspense>`; `apiFetch`; `useAppLocale`.
- `.claude/docs/06-auth.md`: client guard (`components/auth/auth-guard.tsx`), `/auth/confirm` with `token_hash`, `buildConfirmUrl`, account deletion (`delete_my_account()`).
- `.claude/docs/07-features.md`: locale (order, profile adopted once per device), account deletion.
- Spec status line: `**Status:** Implemented on feature/static-export (plan 2026-10-15-static-export-readiness.md)`.

- [ ] **Step 4: Full verification on both targets**

1. `pnpm test` — all pass.
2. `pnpm build && API_CORS_ORIGINS=http://localhost:3200 pnpm start -p 3100` (background); `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e` — all pass.
3. `pnpm build:mobile && pnpm check:export && pnpm serve:mobile` (background); `CI=1 BASE_URL=http://localhost:3200 E2E_TARGET=mobile npx playwright test --project=core --project=live --project=stats` — all pass.
4. Stop both servers; free ports 3100 and 3200.

Record the durations (unit, quick e2e, full e2e) in the task report.

- [ ] **Step 5: Commit**

```bash
git add .github CLAUDE.md .claude/docs docs/superpowers/specs/2026-10-14-static-export-readiness-design.md
git commit -m "ci: lint, unit tests, web build and mobile export; docs for the two build targets"
```

- [ ] **Step 6: Hand-off notes for the user (do not do these yourself)**

Report to the user, in this order (spec "Rollout order"):
1. The migration was applied in Task 12 (or still needs their yes).
2. Merge to `main` → Vercel deploys the web app (`/auth/confirm`, new routes, redirects, client locale). Set `API_CORS_ORIGINS` on Vercel only when the app needs it (sub-project 2).
3. Then deploy the email hook: `pnpm supabase:functions:deploy:send-email` (needs their Supabase login).
4. One release later: remove `app/auth/callback/route.web.ts`.
5. Create the four GitHub Actions variables for CI.
