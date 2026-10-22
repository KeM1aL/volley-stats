# Static-Export Readiness — Design

**Date:** 2026-10-14
**Status:** Implemented on feature/static-export (plan 2026-10-15-static-export-readiness.md)
**Branch:** `feature/static-export` (from `main` @ 9af2ad4)
**Parent:** [Mobile app decision record](2026-10-09-mobile-app-decision.md), sub-project 1 of 3

## Goal

Build the app as a static export (`BUILD_TARGET=mobile`, `output: 'export'`) that the Capacitor
shell of sub-project 2 will bundle, while the Vercel web deployment keeps working. Everything here
is a change to the web codebase; no native project is created.

This sub-project also revises the existing test suites (section 8), first, because it rewrites
every e2e URL and adds a second target to test.

**Done when:**
1. CI passes on `main`: lint against the baseline, unit tests, the web build, and the mobile export
   with its `out/` check.
2. The full web e2e suite passes against the web build (port 3100), and the export suite (quick
   level plus auth and account deletion) passes against `out/` served on port 3200.
3. The test revision meets its targets (section 8): quick e2e level about 1.5 min, unit tests under
   15 s and green while another server runs.
4. On the deployed web app, old URLs redirect, auth emails go through `/auth/confirm`, and the
   chosen language persists.
5. An account can be deleted from settings on both targets.

## What blocks the export today

Next.js 16 `output: 'export'` rejects dynamic segments without `generateStaticParams`, route
handlers that read the request, `proxy`, server actions, cookies/headers, and
`redirects()`/`rewrites()`/`headers()`. Every page is already `"use client"`; the blockers are:

| Blocker | Where |
|---|---|
| Dynamic segments with runtime UUIDs | `matches/[id]/{live,score,stats}`, `teams/[id]`, `teams/[id]/players`, `championships/[id]` (all read `useParams`; ~23 call sites build these URLs) |
| Route handlers | `app/api/import/ffvb`, `app/api/v1/matches/[id]/report`, `app/auth/callback`, `app/serwist/[path]` |
| `proxy.ts` | Auth redirect to `/auth`, `/fr/...` locale rewrite + `NEXT_LOCALE` cookie, session cookie refresh |
| Server locale | `i18n.ts`, `lib/i18n/locale.ts` (cookie, profile, `Accept-Language`), `getLocale()`/`getMessages()` in `app/layout.tsx` |
| Server actions | `lib/i18n/actions.ts` (`updateLocale`, `syncLocaleFromProfile`), called by settings, the language switcher and the auth form |
| PKCE auth links | `send-email` hook links to Supabase `/auth/v1/verify`, which redirects to `/auth/callback?code=…` |
| Service worker | Serwist wrapper in `next.config.js`, `ServiceWorkerProvider` |

Also missing for the stores: in-app account deletion. There is no CI.

## Decisions (from the brainstorm)

| Topic | Decision |
|---|---|
| Splitting the targets | `.web.ts` file suffix + `pageExtensions` per target; `@platform-impl` alias per target (approach 1 of 3; rejected: a pre-build script moving files aside, runtime `if (isMobile)` checks) |
| Routes | Query-param routes on both targets (`/matches/live?id=…`); web redirects old URLs. Dynamic segments can't be exported for ids created at runtime and offline |
| Locale | One client-side path on both targets. Accepted cost: the web's first HTML is untranslated, crawlers see the landing page in English |
| Account deletion | Delete the person (auth user, profile, memberships). For each team they created, the user hands it over to a member with an account or deletes it (revised after the live audit, §5). No club block |
| CI | GitHub Actions: lint (baseline), unit tests, both builds, `out/` check. E2E stays local, on both targets |
| Existing tests | Revised first: API seeding, explicit Playwright project dependencies, a quick level, no silent "if visible" steps; sync unit tests without fixed sleeps (section 8) |

## 1. Build targets and the platform seam

### Build switch

`next.config.js` reads `BUILD_TARGET` (`web` when unset):

| | `web` (Vercel) | `mobile` |
|---|---|---|
| `pageExtensions` | `['web.tsx', 'web.ts', 'tsx', 'ts']` | default, so `*.web.ts(x)` files are not Next files (`route.web` and `proxy.web` match no convention) |
| `output` | default | `'export'`, `trailingSlash: true` (`out/matches/live/index.html`) |
| Serwist (`withSerwist`) | applied | not applied |
| `redirects()` | old-URL redirects (section 2) | none |
| `turbopack.resolveAlias['@platform-impl']` | `./lib/platform/web` | `./lib/platform/mobile` |
| `serverExternalPackages`, `outputFileTracingIncludes` | as today | omitted |

`next-intl/plugin` is removed for both targets (section 4). New scripts: `build:mobile`
(`BUILD_TARGET=mobile next build`) and `serve:mobile` (serves `out/` on port 3200 with a static
file server; `trailingSlash` makes every route a directory with an `index.html`).

Renamed so the mobile build ignores them: `proxy.web.ts`, `app/api/import/ffvb/route.web.ts`,
`app/api/v1/matches/[id]/report/route.web.ts`, `app/auth/callback/route.web.ts`,
`app/serwist/[path]/route.web.ts`. `app/sw.ts` is only an entry for Serwist and is not a Next
file convention, so it stays.

**Verify first** (plan task 1): Next 16 + Turbopack resolves `route.web.ts` as `route` and
`proxy.web.ts` as `proxy` with the web `pageExtensions`, and ignores them with the default ones.
The Next docs confirm `proxy` follows `pageExtensions`. If route files don't, fall back to
approach 2 (a build script that excludes the `*.web.*` files from a temporary copy) and record it
in the plan.

### `lib/platform/`

The only module that knows the target. `lib/platform/index.ts` re-exports `@platform-impl`;
`lib/platform/types.ts` holds the interface both implementations satisfy:

```ts
export interface Platform {
  target: 'web' | 'mobile';
  /** Origin of the web deployment's API. '' on web (same origin); NEXT_PUBLIC_API_ORIGIN on mobile. */
  apiOrigin: string;
  /** Origin for links that leave the app: auth email redirects, shared stats links. */
  webOrigin(): string;
  /** web: @supabase/ssr createBrowserClient (cookies); mobile: supabase-js with localStorage. */
  createSupabaseClient(): SupabaseClient<Database>;
  /** web: SerwistProvider; mobile: renders children only. */
  ServiceWorker: ComponentType<{ children: ReactNode }>;
  /** web: <a download>; mobile: the same for now; sub-project 2 uses Filesystem + Share. */
  saveFile(data: Blob, fileName: string): Promise<void>;
  /** The sync core's signals (connectivity, foreground, persistent storage, device id/label). */
  createSyncPlatform(): SyncPlatform;
}
```

`webOrigin` is `window.location.origin` on web and `NEXT_PUBLIC_WEB_ORIGIN` on mobile.

The sync layer already has its own seam, `SyncPlatform` (`lib/rxdb/sync/platform/types.ts`), with
one web implementation (`lib/rxdb/sync/platform/web.ts`) that `lib/rxdb/database.ts` creates
directly. The interface stays in the sync core; `web.ts` moves to `lib/platform/web/sync.ts`, the
mobile implementation reuses it for now (browser events), and `database.ts` calls
`platform.createSyncPlatform()`. Sub-project 2 swaps in Capacitor `Network`, `App` and `Device`
behind it. Its unit test (`tests/unit/sync/platform-web.test.ts`) follows the file.

The mobile implementations in this sub-project are browser stand-ins, so the export runs and is
tested in a normal browser. Sub-project 2 replaces them with Capacitor plugins behind the same
interface.

`lib/api-client.ts` exports `apiFetch(path, init)`: prefixes `platform.apiOrigin` and always adds
`Authorization: Bearer <access token>` from the current Supabase session, so `/api/v1` routes
check the caller the same way on both targets. The report download in the stats page uses
`apiFetch` and `platform.saveFile`.

### ESLint boundaries (`eslint.config.mjs`, `no-restricted-imports`)

1. `next/headers`, `next/server`, `next-intl/server`: only in `*.web.ts(x)` files and `lib/server/`.
   `lib/supabase/server.ts`, `lib/supabase/middleware.ts` and `lib/report/caller.ts` move to
   `lib/server/` unchanged (except the lazy key read, see Secrets).
2. `react`, `react-dom`, `next`, `next/*`, `next-intl`: not in the core folders
   `lib/{api,auth,commands,importers,keyboard,matches,rxdb,stats,templates,types,utils}`. None
   import them today; the rule keeps it that way.
3. `@platform-impl`, `@capacitor/*`, `@supabase/ssr`: only inside `lib/platform/` (and
   `lib/server/` for `@supabase/ssr`).

## 2. Routes and redirects

### New routes (both targets)

| Today | New |
|---|---|
| `/matches/[id]/live` | `/matches/live?id=…` |
| `/matches/[id]/score` | `/matches/score?id=…` |
| `/matches/[id]/stats` | `/matches/stats?id=…` (public, as today) |
| `/teams/[id]` | `/teams/view?id=…` |
| `/teams/[id]/players` | `/teams/players?id=…` |
| `/championships/[id]` | `/championships/view?id=…` |

Existing query params on these pages stay alongside `id`.

- `hooks/use-route-id.ts`: `useRouteId()` reads `id` from `useSearchParams`, returns `null` when
  missing or not a UUID; pages then render the existing not-found UI.
- Each of the six pages wraps its content in `<Suspense>` (required for `useSearchParams` in a
  static export).
- `lib/routes.ts` builds every in-app link (`routes.matchLive(id)`, `routes.matchStats(id, team?)`,
  `routes.teamPlayers(id)`, …) and holds the public-path list and the redirect-target filter used
  by the auth guard (section 3). All hand-built path strings move to it.
- `components/navigation.tsx` detects the live page with `pathname === '/matches/live'` instead of
  `pathname.includes('/live')`.

### Old URLs (web only)

With `BUILD_TARGET=web`, `redirects()` sends each old pattern to its new route with a 308,
keeping any query string: `/matches/:id/live` → `/matches/live?id=:id`, and likewise for the
other five. Shared stats links, bookmarks and installed PWAs keep working. The mobile export has
no redirects; sub-project 2 maps incoming universal links on old paths to the new routes.

Direct links and SEO: query-param URLs share, bookmark and open from email like path URLs, and
Universal/App Links match on the path and pass the query to the app. These pages are
client-rendered and (except stats) behind sign-in, so they carry no SEO value before or after.

### `/api/v1` CORS

A helper in `lib/server/cors.ts` adds CORS to `/api/v1/*` responses and answers `OPTIONS`
preflights: allowed origins from `API_CORS_ORIGINS` (comma-separated), methods
`GET, POST, DELETE, OPTIONS`, headers `Authorization, Content-Type, If-None-Match`, exposed
`ETag, Content-Disposition`, no credentials (Bearer only). An origin not on the list gets no CORS
headers. E2E sets `http://localhost:3200`; sub-project 2 adds `capacitor://localhost` and
`https://localhost`.

### FFVB import

`app/api/import/ffvb/route.web.ts` stays where it is and keeps its current behavior (it uses the
service role and checks no caller rights; securing and moving it to `/api/v1` remains in
sub-project 2). The mobile build hides the FFVB import button (`platform.target === 'mobile'`)
until then.

## 3. Auth

### Client-side guard (both targets)

`components/auth/auth-guard.tsx` sits inside `AuthProvider` in `app/layout.tsx`. While the
session loads it shows the existing loading page; with no session on a protected path it calls
`router.replace('/auth?redirectTo=<path+query>')`. Public paths (`/`, `/auth`, `/auth/*`,
`/matches/stats`) and the redirect-target filter (`shouldSaveRedirect` today) live in
`lib/routes.ts`.

`proxy.web.ts` keeps the session cookie refresh and the locale prefix (section 4) and no longer
redirects to `/auth`.

### Auth emails: `token_hash`

- The `send-email` hook (`supabase/functions/send-email`) builds every action link as
  `<site>/auth/confirm?token_hash=<hash>&type=<email_action_type>&next=<path>` instead of
  `<supabase>/auth/v1/verify?token=…&redirect_to=…`. `<site>` and `next` come from the hook's
  `redirect_to`. The `lang + '/auth'` suffix appended to the sign-up `redirect_to` is removed.
- New client page `app/auth/confirm/page.tsx`: `supabase.auth.verifyOtp({ token_hash, type })`.
  On success, `type=recovery` goes to `/auth/reset-password`, others to `next` (if it passes the
  redirect-target filter) or `/`. On failure it shows the existing expired-link card with a link
  back to `/auth`.
- A `token_hash` link is not bound to the browser that requested it (PKCE is), so a reset
  requested in the app can be opened on a desktop.
- `resetPasswordForEmail` and `signUp` pass `redirectTo` / `emailRedirectTo` built from
  `platform.webOrigin`, so links always point to the web domain.
- `app/auth/callback/route.web.ts` stays for one release so emails sent before the hook deploy
  still work; the spec's follow-ups list its removal.

### Supabase client

`lib/supabase/client.ts` calls `platform.createSupabaseClient()`:
- web: `@supabase/ssr` `createBrowserClient` (cookies), unchanged, so web sessions survive the
  deploy and the report route's cookie fallback keeps working.
- mobile: `supabase-js` `createClient` with `storage: localStorage`, `persistSession: true`,
  `autoRefreshToken: true`, `detectSessionInUrl: false` (the confirm page handles email links).

## 4. Locale

`components/providers/locale-provider.tsx` (client) wraps `NextIntlClientProvider` and replaces
next-intl's server side.

**Locale choice**, first match wins:
1. `?lang=` in the URL (set by the web proxy for `/fr/...`), then removed with `router.replace`.
2. `localStorage['locale']`.
3. The first supported entry of `navigator.languages`.
4. `en`.

When a user is signed in for the first time on this device, `profiles.language` is adopted and
saved locally (replaces `syncLocaleFromProfile()` after sign-in), unless the page was opened with
an explicit `?lang=`. After that the device's choice wins; changing the language writes both. The
adopted user id is stored next to the locale (`volleystats:locale-user`).

**Messages:** `import(\`@/messages/${locale}\`)`, one chunk per locale (bundled in the export,
fetched and cached by the service worker on web). Until loaded, the provider renders the
existing loading page. It sets `document.documentElement.lang` and passes `timeZone` from
`Intl.DateTimeFormat().resolvedOptions().timeZone`.

**Changing language:** `useAppLocale()` returns `{ locale, setLocale }`. `setLocale` saves to
`localStorage`, updates `profiles.language` through the profile API when signed in, and swaps
messages in place (no `router.refresh()`). It replaces `updateLocale()` in `app/settings/page.tsx`,
`components/language-switcher.tsx` and `components/auth/auth-form.tsx`.

**Removed:** `lib/i18n/actions.ts`, `lib/i18n/locale.ts`, `i18n.ts`, the `next-intl/plugin`
wrapper, `getLocale()`/`getMessages()` in `app/layout.tsx` (the layout becomes static, with
`<html lang="en">` updated client-side).

**Web proxy:** `/fr/matches` → 307 redirect to `/matches?lang=fr` (query string kept), instead of
a rewrite + `NEXT_LOCALE` cookie. Existing `NEXT_LOCALE` cookies are ignored: signed-in users get
their profile language; signed-out returning visitors fall back to the browser language once.

**Server translations:** `app/api/import/ffvb/route.web.ts` replaces `getTranslations` with
`createTranslator({ locale: 'en', messages })` from `next-intl`. The PDF report already resolves
its own locale.

## 5. Account deletion

Revised 2026-10-15 after the live audit (`docs/superpowers/notes/2026-10-15-user-fk-audit.md`):
club memberships grant no rights in any policy and the app has no way to hand over a club, so
there is no sole-club-owner block; and every write to a team's data is gated by
`teams.user_id = auth.uid()` (the team's creator), so each team the leaving user created needs
the user's decision.

### What the user decides

For every team they created (`teams.user_id = auth.uid()`, `_deleted = false`), the deletion
dialog shows one searchable select (`components/ui/generic-select.tsx`, react-select) with:
- **Delete the team**, and
- one entry per **eligible member**: a `team_members` row of that team with a `user_id`
  (linked account), `archived_at` null, `_deleted` false, and `user_id` ≠ the leaving user,
  labelled with the member's name. Choosing one hands the team over to that person.

If a team has no eligible member, the select offers only **Delete the team** and the dialog
says no member of this team has an account to take it over. The confirm button stays disabled
until every team has a choice and the typed email matches.

### Database (one migration)

`public.delete_my_account(decisions jsonb)`: `security definer`, `set search_path = ''`,
`execute` revoked from `public` and `anon`, granted to `authenticated`. `decisions` is a JSON
array of `{ "team_id": uuid, "action": "delete" | "transfer", "new_owner": uuid | null }`. In
one transaction:
1. Every team created by `auth.uid()` (not deleted) has exactly one decision, and no decision
   names another team; otherwise raise `invalid_decisions` (nothing changes).
2. A `transfer` names an eligible member of that team (definition above); otherwise raise
   `invalid_new_owner`.
3. Apply: `transfer` sets `teams.user_id` to the new owner and that member's
   `team_members.role` to `owner`; `delete` soft-deletes the team (`_deleted = true`) and its
   `team_members` rows. The team's matches are kept: each also belongs to the opponent's history.
4. `delete from auth.users where id = auth.uid()`; foreign keys do the rest.

Foreign keys on user columns (from the audit), set by the same migration:

| Column | Today | On user delete |
|---|---|---|
| `profiles.id` | cascade | cascade (unchanged) |
| `club_members.user_id` | cascade | cascade (unchanged) |
| `matches.scorer_user_id` | set null | set null (unchanged) |
| `team_members.user_id` | no action | set null (the leaver's own player row stays, unlinked) |
| `teams.user_id` | no action | set null (reached only by the teams soft-deleted in step 3 and by teams already soft-deleted before; live teams were all handed over) |
| `clubs.user_id`, `championships.user_id` | no action, not null | set null; drop `not null` |

Why an RPC and not an `/api/v1/account` route: same call on both targets, no CORS, no
service-role key in a caller-driven path.

### UI (`/settings`, both targets)

A "Delete account" card at the bottom of settings. The web page is also the deletion URL Google
Play asks for.
- Unsent live-match changes (`pending_changes` not empty, or the local database not open yet):
  the button is disabled with a message to wait for upload.
- Dialog: what is deleted (account, profile, memberships) and what stays (matches and stats);
  one row per created team with its select; the user types their email to confirm.
- Errors from the RPC (`invalid_decisions`, `invalid_new_owner`, any other) show a message in
  the dialog; nothing is deleted.
- Success: sign out, remove the local RxDB database and the stored locale, go to
  `/auth?account-deleted=1`, which shows "Your account has been deleted."

New strings in all five locales (`pnpm i18n:check` passes).

## 6. Secrets

- The only server secret is `SUPABASE_SERVICE_ROLE_KEY`. It stays a server env var on Vercel,
  read only in `lib/server/`, never under a `NEXT_PUBLIC_` name, never in the mobile build, never
  in CI.
- `lib/server/supabase.ts` reads the key when a client is first created instead of at import, so
  builds don't need it.
- Public build values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN`) are GitHub Actions *variables*. The anon key
  is public by design (RLS protects data) and ships in both bundles.
- `scripts/check-export.mjs` fails if any file in `out/` contains a JWT (`eyJ…`) whose decoded
  payload has `"role":"service_role"`, a Supabase secret key (`sb_secret_…`), or the value of
  `SUPABASE_SERVICE_ROLE_KEY` when that variable is set locally. Matching on decoded tokens
  rather than the bare word `service_role` avoids false positives from library code.
- Docs, specs, plans and commits name env variables only, never values.

## 7. CI and testing

### GitHub Actions (`.github/workflows/ci.yml`)

On push and pull requests to `main`; Node 24, pnpm from `packageManager`, pnpm store cached.
1. Lint: `node scripts/lint-report.mjs` then `node scripts/lint-summary.mjs <report> --baseline
   docs/superpowers/notes/lint-baseline.json`; fails when a rule's error count exceeds the baseline
   (`pnpm lint` fails today with 42 pre-existing errors). The new boundary rules have no baseline
   entries, so any violation fails. If `lint-summary.mjs` does not exit non-zero on an increase, it
   gains that behavior.
2. `pnpm test`.
3. `pnpm build`.
4. `pnpm build:mobile`, then `node scripts/check-export.mjs`: `out/` has an `index.html` for `/`,
   `/auth`, `/auth/confirm`, `/auth/reset-password`, `/matches`, `/matches/live`, `/matches/score`,
   `/matches/stats`, `/teams`, `/teams/new`, `/teams/view`, `/teams/players`, `/championships`,
   `/championships/view`, `/settings`; no path segment starting with `[`; no `serwist/`, `sw.js`
   or `api/`; plus the secret scan of section 6.

### E2E (local)

- Web: unchanged (`pnpm build && pnpm start -p 3100`, `BASE_URL=http://localhost:3100`).
- Export: `NEXT_PUBLIC_API_ORIGIN=http://localhost:3100 pnpm build:mobile`, `pnpm serve:mobile`
  (3200), with the web server on 3100 started with `API_CORS_ORIGINS=http://localhost:3200`; run
  `BASE_URL=http://localhost:3200 E2E_TARGET=mobile pnpm test:e2e:quick` plus the `auth` and
  `account` specs (section 8 defines the levels).
- Web-only specs carry a `@web` tag and are skipped when `E2E_TARGET=mobile`: service worker
  cache (`05b-sw-cache`), old-URL redirects, the `/fr/` prefix.
- All specs move to the new URLs (through `lib/routes.ts` where they build URLs).
- New specs: old-URL redirects (`@web`); `/auth/confirm` with an invalid token shows the expired
  card; `/fr/teams` shows French and ends on a clean URL (`@web`); account deletion (throwaway
  account deleted, sign-in then fails) and the sole-owner block.
- Unit tests: locale choice order; `useRouteId` parsing; `lib/routes.ts` builders and the
  redirect-target filter; the CORS helper.

### Docs

`CLAUDE.md` and `.claude/docs/` (02-architecture, 03-code-patterns, 06-auth, 07-features):
the two build targets, `lib/platform`, `lib/routes.ts`, the `.web.ts` convention, the client
locale, `/auth/confirm`, and the new commands.

## 8. Test suite revision (done first)

### Measured (2026-10-14, production build, one worker, this machine)

- E2E: 27 passed, 4 skipped in 4.0 min, plus 49 s for `pnpm build`.
  - `01-teams`: 53 s. It creates the team and 8 players one dialog at a time.
  - The 7 live-match tests (`04`, `04d` ×2, `04e`, `04f`, `04g`, `04h`): 8–29 s each, about
    2 min together. Each first builds its match through the UI: filters, new-match dialog, start
    dialog, players ticked one by one, 6 court positions.
  - `02-matches` (full match): 23 s. All other tests: 7 s or less.
- Unit: 434 tests in 44 s, with one failure. `tests/unit/sync/manager.test.ts` alone takes 43 s
  (48 tests, about 1 s each, real `sleep(300)`/`sleep(500)` waits). Its timing-sensitive test fails
  while another server loads the machine.

About 4 minutes for 27 browser tests against a real backend is normal. The 10–17-minute task
cycles came from rebuilding and running the whole suite for every task, with a dev server
competing for the CPU. The other problems found:
- Specs depend on each other through file-name order and `tests/fixtures/test-data.json`, which is
  tracked in git and rewritten by every run.
- Many steps act only "if visible", so a missing button skips the step instead of failing.
- 27 fixed `waitForTimeout` calls; a 5-minute default timeout, so a stuck test hangs 5 minutes.
- The opt-in tools `04b-rxdb-capture`, `04c-rxdb-legacy` and `06z-screenshots` always show as
  skipped.
- `07-team-detail-cleanup` › "delete E2E team" is a permanent `test.fail` (a known app bug:
  deleting a team with matches hits `matches_home_team_id_fkey`).

### E2E changes

1. **Seed by API.** A `seed` setup project runs after `auth` and creates "E2E Team <run id>"
   with its 8 players through Supabase as the test user (`tests/helpers/server-data.ts`, RLS
   applies). It writes the fixture to `playwright/.data/fixture.json` (git-ignored).
   `tests/fixtures/test-data.json` is deleted from the repo.
   - `01-teams` keeps a short UI test: create a team, rename it, add one player.
   - `createAndStartMatch` creates the match by API and uses the UI only for the start dialog.
     The new-match dialog stays covered by one test in `02-matches`.
   - Specs that test the court setup (`02`, `04`) keep the UI flow through `setupCourtPositions`.
2. **Dependencies are explicit**, through Playwright projects instead of file order:
   `setup` → `seed` → `core` (teams, championships, settings, UI details, public access) and
   `live` (`04*`) → `finished-match` (`02`, writes the completed match id) → `stats` (`06`, the
   finished-match case of `04g`). Running one project pulls in what it needs.
3. **Two levels:** `pnpm test:e2e:quick` runs `core` and `live` (target about 1.5 min);
   `pnpm test:e2e` runs everything. A `tools` project holds `04b`, `04c` and `06z` and runs only
   when named (`--project=tools`).
4. **Reliability:**
   - Every "if visible then act" step becomes an assertion, or is removed when the step isn't needed.
   - Fixed `waitForTimeout` calls become web-first waits on the state they were waiting for.
     The 500 ms search debounce waits for the filtered row instead.
   - The default timeout drops to 90 s; only the full-match and two-device tests set more.
   - The permanent `test.fail` cleanup test is removed: global teardown already deletes E2E data.
     The team-deletion bug goes to the follow-ups.
5. **Workers:** after the changes, try 2 workers. Keep the setting only if the full suite passes
   three runs in a row on the developer machine; otherwise stay at 1.

### Unit changes

- In the sync tests, fixed `sleep()` waits become `waitFor(condition)`. Where a wait proves
  something must not happen, it gets a short, named window helper.
- `manager.test.ts` is split by concern (connectivity and resume, scorer claim and takeover, lost
  matches, reference replication) so Vitest runs the files in parallel.
- Target: `pnpm test` under 15 s, and green while a production server runs on the same machine.

### Docs

`CLAUDE.md` gets "Which tests to run when":
- During a task: the unit tests plus the e2e projects the change touches, or `test:e2e:quick`.
- Before merging: the full `test:e2e`.
- No dev server while e2e runs.

The e2e section of `.claude/docs/` describes the projects and the seed.

### Not included

A dedicated Supabase project for tests: e2e keeps writing to the real project and cleaning up by
name pattern. Possible follow-up.

## Rollout order

1. Migration (foreign keys + `delete_my_account`), checked on the live constraints first.
2. Web deploy with `/auth/confirm`, the new routes and redirects, the client locale and guard.
3. `send-email` hook deploy with `token_hash` links (after step 2, so links never point to a
   missing page).
4. Next release: remove `app/auth/callback/route.web.ts`.

## Out of scope

Capacitor projects, native plugins, `/api/v1` for the FFVB import, universal link files, the
minimum-version check (all sub-project 2); server-rendered share pages with Open Graph previews
for match stats (possible web-only follow-up); e2e in CI.

## Follow-ups

- Remove `app/auth/callback/route.web.ts` one release after the hook deploy.
- Optional web-only share route (`/s/<id>`) with per-match Open Graph metadata.
- Deleting a team that has matches fails (`matches_home_team_id_fkey`); fix the app, then add an
  e2e test for it.
- A dedicated Supabase project (or branch) for e2e data.
