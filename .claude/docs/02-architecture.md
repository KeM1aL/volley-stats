# Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App Router                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Components (app/ + components/)                │  │
│  │  - Server Components (SSR)                            │  │
│  │  - Client Components (CSR)                            │  │
│  │  - Shadcn/ui + Radix UI                               │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │  State Management Layer                               │  │
│  │  - React Context (AuthContext, LocalDatabaseProvider) │  │
│  │  - Custom Hooks (useTeamApi, useMatchApi, etc.)      │  │
│  │  - Command Pattern (Undo/Redo Stack)                 │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
          ┌────────────────┴─────────────────┐
          │ Other screens                    │ Live match (offline)
   ┌──────▼──────────┐            ┌──────────▼──────────┐
   │   API Layer     │            │  RxDB (Local DB)    │
   │   (lib/api/)    │            │  - Dexie Storage    │
   │  - Repository   │            │  - 13 Collections   │
   │    Pattern      │            │  - Commands write   │
   │  - Factory      │            │    here             │
   │    Pattern      │            └──────────┬──────────┘
   └────────┬────────┘                       │ SyncManager
            │                                │ (RxDB replication)
   ┌────────▼────────────────────────────────▼─┐
   │                 Supabase                  │
   │  - PostgreSQL   - Auth                    │
   │  - Realtime     - RLS                     │
   └───────────────────────────────────────────┘
```

## Data Flow Architecture

Two paths, chosen by screen:

```
Screens other than the live match (teams, championships, match list, settings…)
      ↓
React Component
      ↓
Custom Hook (e.g., useTeamApi)
      ↓
API Layer (lib/api/) → Supabase (direct calls, requires connectivity)


Live match tracking (app/matches/live?id=<matchId>)
      ↓
syncMatch(matchId) pulls that one match into RxDB on page load
      ↓
User action → Command (lib/commands/) → RxDB write (useLocalDb)
      ↓
SyncManager replication pushes to Supabase when online
```

Local data stays scoped to what a match needs: reference data plus the matches opened with `syncMatch(matchId)`. Don't sync whole tables to the device. See [04-offline-sync.md](04-offline-sync.md).

## Build targets

`next.config.js` reads `BUILD_TARGET` (`web` when unset). One codebase, two builds:

| | `web` (Vercel) | `mobile` (`BUILD_TARGET=mobile`, `pnpm build:mobile`) |
|---|---|---|
| Output | server build (`pnpm build`, `pnpm start`) | `output: 'export'`, `trailingSlash: true`: `out/matches/live/index.html` |
| `pageExtensions` | `web.tsx`, `web.ts`, `tsx`, `ts`, `jsx`, `js` | `tsx`, `jsx` only |
| Server-only files | `proxy.ts` and `app/**/route.web.ts` are Next files | left out of the build (they match no extension) |
| Service worker (Serwist) | applied (`withSerwist`) | not applied |
| `redirects()` | 308 redirects from the old `/matches/<uuid>/live`... URLs | none |
| `@platform-impl` alias | `lib/platform/web` | `lib/platform/mobile` |
| API calls (`apiFetch`) | same origin | `NEXT_PUBLIC_API_ORIGIN` (the web deployment) |

Limitation: the mobile target leaves out every `.ts` file, because `proxy.ts` must keep that exact name (Next 16 only recognises `proxy`) and cannot carry a `.web` suffix. A future `.ts` Next convention file (e.g. `app/robots.ts`, `app/sitemap.ts`) would be silently left out of the export: write it as `.tsx` or add it to the export check. Every page and layout is `.tsx`.

Environment variables (names only; values in `.env.local` or the host):
- `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN`: the origin of the web deployment's API and of the web app. Required by `pnpm build:mobile` (the build fails without them); the web target does not need them. They are inlined in the bundle, so they must be public values.
- `API_CORS_ORIGINS`: comma-separated origins allowed to call `/api/v1` from another origin (the static export). Web server only; see `lib/server/cors.ts`.
- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) reads four GitHub Actions *repository variables* (Settings, Secrets and variables, Actions, Variables; public values, no secret): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN`. Without them the web build fails at prerender (the Supabase config throws) and `build:mobile` fails.
- `E2E_API_URL`: only for the export e2e suite; the web server that the export under test calls for `/api/v1`.
- `CAP_DEV_HTTP=1`: read by [capacitor.config.ts](../../capacitor.config.ts) at `cap sync` / `cap run`; allows cleartext HTTP for local development against a PC web server (`http://10.0.2.2:<port>` from the Android emulator). Never for a release build.
- `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `ANDROID_PACKAGE`, `ANDROID_CERT_SHA256` (comma-separated fingerprints): web server only; the values of the `/.well-known` association files (see below). Each file answers 404 while its values are unset.

Commands:
- `pnpm build:mobile`: static export in `out/`.
- `pnpm check:export`: checks `out/` (expected pages exist, no server-only file, secret scan).
- `pnpm serve:mobile`: serves `out/` on port 3200.
- Export e2e suite: start the web server with `API_CORS_ORIGINS=http://localhost:3200 pnpm start -p 3100` and `pnpm serve:mobile`, then `CI=1 BASE_URL=http://localhost:3200 E2E_TARGET=mobile E2E_API_URL=http://localhost:3100 npx playwright test --project=core --project=live --project=stats`. Tests tagged `@web` are skipped on the mobile target.

### `lib/platform/`

The only module that knows the target: `lib/platform/index.ts` re-exports `@platform-impl` (`web/` or `mobile/`); `types.ts` holds the `Platform` interface (`target`, `apiOrigin`, `webOrigin()`, `createSupabaseClient()`, `ServiceWorker`, `Analytics`, `saveFile()`, `createSyncPlatform()`); `shared/` holds what both implementations reuse (the browser sync signals, a passthrough provider). The `Platform` also carries `hardNavigate()` (a full page load; on mobile it goes through `/?to=`, see [11-mobile-app.md](11-mobile-app.md)) and the device features (`nativePlatform`, `keepAwake`, `haptics`, `appVersion`, `onForeground`, `onAppUrlOpen`, `onBackButton`, `exitApp`, `watchStatusBar`): `web/native.ts` uses browser APIs or no-ops, `mobile/native.ts` the Capacitor plugins. The mobile implementation uses Capacitor plugins (Preferences for the auth session, Network/App for the sync signals, Filesystem + Share for `saveFile`) only when `Capacitor.isNativePlatform()`; the same export opened in a browser behaves like web. Components call `platform.*`; they never test the target themselves.

### Capacitor app

The `mobile` export runs inside a Capacitor 8 shell (`capacitor.config.ts`, committed `android/` and `ios/`, `webDir: 'out'`). Capacitor's local server answers every path without an extension with the root `index.html`, so full page loads of sub-paths go through `platform.hardNavigate` and `components/native/boot-redirect.tsx`. Build, run, native features, compatibility policy for old app versions: [11-mobile-app.md](11-mobile-app.md).

### `.well-known` association files

`app/.well-known/apple-app-site-association/route.web.ts` and `app/.well-known/assetlinks.json/route.web.ts` (web target only; content built in `lib/server/app-links.ts` from `APPLE_TEAM_ID` + `IOS_BUNDLE_ID` and `ANDROID_PACKAGE` + `ANDROID_CERT_SHA256`). They tie the web origin to the apps for universal links and Android app links; 404 while the variables are unset.

### `lib/server/`

Server-only helpers for route handlers and the proxy: `supabase.ts` (service-role client, read on use), `session.ts` (`updateSession`: refreshes the session cookie), `report-caller.ts` (`getReportCaller`: the signed-in caller from a Bearer token or the cookie, RLS applying), `admin.ts` (`requireAdmin`: 401 / 403 unless `profiles.role` is `admin`), `app-links.ts` (the `.well-known` file contents), `cors.ts` (`/api/v1` CORS from `API_CORS_ORIGINS`).

### ESLint import boundaries

[eslint.config.mjs](../../eslint.config.mjs) enforces the split:
- `next/headers`, `next/server`, `next-intl/server` and `@supabase/ssr` can only be imported in `*.web.ts(x)`, `proxy.ts` and `lib/server/` (Supabase clients are only created in `lib/platform/` and `lib/server/`).
- The core folders (`lib/{api,auth,commands,importers,keyboard,matches,rxdb,stats,templates,types,utils}`) import no React or Next.

### Routes

Dynamic segments cannot be exported for ids created at runtime (and offline), so ids travel as `?id=`: `/matches/{live,score,stats}`, `/teams/{view,players}`, `/championships/view`. [lib/routes.ts](../../lib/routes.ts) builds every in-app URL (`routes.matchLive(id)`...); on web, the old `/matches/<uuid>/live`... URLs 308-redirect to them.

---

## Directory Structure

```
volley-stats/
├── app/                          # Next.js App Router pages
│   ├── auth/                     # Authentication pages
│   ├── championships/            # Championship management
│   ├── matches/                  # Match management
│   │   ├── live/                # Live match tracking (CORE FEATURE), ?id=<matchId>
│   │   ├── score/               # Score entry, ?id=
│   │   └── stats/               # Match statistics, ?id=
│   ├── settings/                 # User settings
│   ├── teams/                    # Team management (view/, players/ with ?id=)
│   ├── api/import/ffvb/route.web.ts             # FFVB match import (web target only; admin only: lib/server/admin.ts requireAdmin; its button shows only for admins on the web build)
│   ├── api/v1/matches/[id]/report/route.web.ts  # Match PDF report (web target only)
│   ├── auth/confirm/             # Verifies token_hash email links
│   ├── auth/callback/route.web.ts  # Old PKCE link handler (to delete once the send-email function is deployed)
│   ├── .well-known/              # apple-app-site-association and assetlinks.json (web target only)
│   └── serwist/[path]/route.web.ts # Service worker (web target only)
│
├── components/                   # React components (feature-based)
│   ├── auth/                     # Authentication UI
│   ├── championships/            # Championship components
│   ├── clubs/                    # Club management
│   ├── matches/                  # Match-related components
│   │   ├── live/                # Live tracking UI
│   │   └── stats/               # Statistics displays
│   ├── players/                  # Player management
│   ├── providers/                # Context providers
│   │   └── local-database-provider.tsx  # RxDB provider + useLocalDb()
│   ├── report-pdf/               # @react-pdf/renderer report document
│   ├── teams/                    # Team components
│   └── ui/                       # Shadcn/ui components
│
├── contexts/                     # React Context providers
│   ├── auth-context.tsx         # Authentication context
│   └── keyboard-context.tsx     # Virtual keyboard state (mobile)
│
├── hooks/                        # Custom React hooks
│   ├── use-team-api.ts          # Team API wrapper
│   ├── use-match-api.ts         # Match API wrapper
│   ├── use-local-database.ts    # RxDB instance management
│   ├── use-command-history.ts   # Undo/redo functionality
│   └── use-toast.ts             # Toast notifications
│
├── lib/                          # Core business logic
│   ├── api/                      # API layer (Supabase abstraction)
│   │   ├── datastore.ts         # DataStore interface
│   │   ├── supabase.ts          # SupabaseDataStore implementation
│   │   ├── types.ts             # Filter / Sort types
│   │   ├── championships/       # One createXApi factory per domain:
│   │   ├── clubs/               #   teams, team-members, championships,
│   │   ├── events/              #   clubs, matches, seasons,
│   │   ├── match-formats/       #   match-formats, events
│   │   ├── matches/
│   │   ├── seasons/
│   │   ├── team-members/
│   │   ├── teams/
│   │   └── index.ts             # createApi() / getApi()
│   ├── commands/                 # Command pattern (undo/redo)
│   │   ├── command.ts           # Command, MatchState, CommandHistory
│   │   └── match-commands.ts    # SetSetup, Substitution, PlayerStat, ScorePoint commands
│   ├── i18n/                     # Locale list, ?lang= / localStorage / browser resolution, /fr/ path helpers
│   ├── platform/                 # Web / mobile implementations behind @platform-impl
│   ├── server/                   # Server-only helpers (service-role client, session refresh, report caller, CORS)
│   ├── routes.ts                 # Every in-app URL (ids as ?id=)
│   ├── api-client.ts             # apiFetch: calls the web API with the Bearer token
│   ├── importers/                # Data import utilities (FFVB)
│   ├── report/                   # Match PDF report: metrics, model, loading, access
│   ├── rxdb/                     # RxDB configuration
│   │   ├── sync/
│   │   │   ├── manager.ts           # SyncManager: user, tracked matches, scorer claim, resume
│   │   │   ├── match-sync.ts        # The five replications of one match
│   │   │   ├── reference-sync.ts    # Pull-only replications of reference tables
│   │   │   ├── replication.ts       # replicateSupabase (RxDB ↔ Supabase adapter)
│   │   │   ├── pending-changes.ts   # pending_changes collection: every unsent row
│   │   │   ├── dependencies.ts      # Parent-first gate and claim gate
│   │   │   ├── errors.ts            # Push error classification
│   │   │   ├── conflict-handler.ts  # Scoring device wins conflicts on match data
│   │   │   ├── tracked-matches.ts   # Tracked matches (local document)
│   │   │   ├── sync-state.ts        # Per-match sync state (local document)
│   │   │   ├── scorer-claim.ts      # claim_match_scorer / get_match_scorer RPCs
│   │   │   ├── status.ts            # Sync badge state
│   │   │   ├── upgrade.ts           # One-time upgrade of devices from the old sync
│   │   │   ├── timestamps.ts        # Microsecond timestamp helpers
│   │   │   ├── helper.ts            # Query and schema helpers for the adapter
│   │   │   ├── types.ts             # Shared sync types and table lists
│   │   │   └── platform/            # SyncPlatform interface (connectivity, foreground, device id); the browser implementation is lib/platform/shared/sync.ts
│   │   ├── collections.ts       # Collection setup (13 collections incl. pending_changes)
│   │   ├── database.ts          # RxDB setup
│   │   ├── pending-hint.ts      # Unsent-changes hint in localStorage
│   │   ├── reset-policy.ts      # When a database reset is allowed
│   │   └── schema.ts            # RxDB schemas
│   ├── stats/                    # Statistics calculation
│   ├── supabase/                 # Supabase types and the browser client
│   │   ├── client.ts            # Browser client (created by lib/platform)
│   │   └── database.types.ts    # Generated DB types (pnpm supabase:types)
│   ├── utils/                    # Utility functions
│   ├── types.ts                  # TypeScript type definitions
│   ├── types/events.ts           # Event types (substitution, timeout, …)
│   └── enums.ts                  # Enums for constants
│
├── messages/                     # next-intl translations (en, es, fr, it, pt)
├── proxy.ts                      # Web only: refreshes the session cookie, /fr/... becomes ?lang=fr
├── scripts/                      # build-mobile, cap-sync, sync-app-version, make-app-assets, check-export, serve-export, lint report
├── capacitor.config.ts           # Capacitor shell config (app id, name, CAP_DEV_HTTP)
├── android/, ios/                # Native projects (committed)
├── tests/e2e/                    # Playwright E2E tests
│
└── supabase/                     # Supabase configuration
    ├── functions/                # Edge functions (send-email, health)
    └── migrations/               # Database migrations
```
