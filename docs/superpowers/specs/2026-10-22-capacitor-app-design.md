# Capacitor App and Mobile API — Design

**Date:** 2026-10-22
**Status:** Draft, for review
**Branch:** `feature/capacitor-app` (from `main` @ dd28584)
**Parent:** [Mobile app decision record](2026-10-09-mobile-app-decision.md), sub-project 2 of 3
**Builds on:** [Static-export readiness](2026-10-14-static-export-readiness-design.md) (sub-project 1)

## Goal

Wrap the `BUILD_TARGET=mobile` static export in a Capacitor shell for Android and iOS, replace
the browser stand-ins behind `lib/platform` with native implementations, and prepare
everything the stores need, so that publishing is a checklist once the accounts exist.

### Where this sub-project stops

The developer has a Windows PC, an iPhone and an iPad, no Mac, and no Apple or Google
developer account yet. The store fees (Apple about 99 USD a year, Google 25 USD once) will be
paid once the app is ready. The production domain and the app's store name are also decided
later. So the work splits in two:

| Part | When | Content |
|---|---|---|
| **A — this sub-project** | now | Everything that needs no account, domain or name: the native projects, the Capacitor platform, native features, the admin role and FFVB lock, the version check, the compatibility policy, icons and splash, the privacy page and manifest, CI builds for both platforms, and a written release checklist for part B |
| **B — release checklist** | when the accounts, domain and name exist | Signing, link association values, TestFlight, store listings, submission. Executed by following the checklist written in part A; not designed further here |

Accepted risk: the app first runs on an iPhone or iPad only in part B, through TestFlight (no
Mac means no simulator either). iOS-specific problems (WebView storage, links, keyboard, safe
areas) appear only then. The recommendation to the user is to pay the Apple fee as soon as the
Android app works, to leave one to two weeks of iPad testing before submission.

**Done when (part A):**
1. The Android app built from this branch runs on the Android emulator on the developer's PC
   (and on an Android phone if one is available): sign-in, team and match screens, a full live
   match played in airplane mode then synced when back online, the report shared through the
   share sheet, the Android back button, the update screen, and the landscape hint.
2. CI on `main` passes: existing checks, plus an Android debug build and an unsigned iOS
   simulator build on a GitHub-hosted macOS runner.
3. The FFVB import works on the web for an admin and returns 403 for anyone else.
4. The web e2e suite and the export e2e suite pass (section 10).
5. The part B checklist exists in the repo.

## Decisions (from the brainstorm)

| Topic | Decision |
|---|---|
| iOS builds without a Mac | GitHub Actions macOS runners (the repository `KeM1aL/volley-stats` is public, so they are free). Codemagic's free personal tier (500 macOS minutes a month) is the fallback. A macOS VM on the PC (Docker-OSX) is rejected: Apple's licence allows macOS only on Apple hardware, recent Xcode 26 releases need macOS Tahoe, and the setup is slow and fragile |
| Store accounts | Paid by the user when the app is ready; part B |
| Domain, store name, bundle id | Decided later; everything that depends on them is a setting (section 7) |
| FFVB import | Stays on the web deployment only (not moved to `/api/v1`), restricted to application admins |
| Admin role | A `role` column on `profiles` (`user` / `admin`), protected by a trigger (section 3) |
| Old app versions | Backward-compatible migrations as a rule, plus a minimum-version check (section 5). No live updates for now. Applies from the first store release; there are no live users today |
| Devices | The user scores mainly on an iPad; the live match page suggests landscape (section 4) |
| Google Analytics | Left out of the mobile build for now; analytics and consent are handled later |
| `app/auth/callback` | Removed now (no live users, so no old email links are pending) |

## 1. Native projects

- Capacitor 8 (the current major version; confirm at install), with `capacitor.config.ts` at
  the repository root and `webDir: 'out'`. The `ios/` and `android/` folders are committed.
- App id and display name come from the config: `appId` defaults to a working id
  (`com.volleystats.app`, my call) and `appName` to `VolleyStats`. Both are revisited in part B:
  the id becomes permanent at the first store upload, and the "For Dummies" wording must not be
  used anywhere (Wiley trademark; stores reject it).
- Scripts (names are the builder's call): build the export and run `cap sync`, open Android
  Studio, run on a device or emulator.
- iOS: deployment target is the Capacitor 8 default. Android: `minSdk` and `targetSdk` are the
  Capacitor 8 defaults (the Play Store's current target API level requirement is checked in
  part B).
- Orientations: all, on both platforms (iPad split-screen requires all four).
- `NEXT_PUBLIC_API_ORIGIN` / `NEXT_PUBLIC_WEB_ORIGIN` for app builds: the current web
  deployment's address until the domain exists. For local development against a web server on
  the PC, the Android emulator reaches it at `http://10.0.2.2:<port>`; this needs cleartext
  allowed in a development-only Capacitor config, never in the release config.

### Verify first (plan task 1)

Capacitor's local web server on both platforms serves the **root** `index.html` for any path
without a file extension (single-page-app behaviour). The export is multi-page
(`out/matches/live/index.html`). Client-side navigation is unaffected (Next fetches
`…/index.txt` payloads, which have an extension), but a full page load on a sub-path is not:
- `window.location.assign('/auth?account-deleted=1')` in `components/settings/delete-account-card.tsx`;
- any reload while on a sub-page;
- incoming links if they were loaded as full pages (section 6 routes them client-side instead).

Task 1 builds a bare Android shell, confirms the behaviour, and picks the fix. Options, in order
of preference: (a) on mobile, replace hard navigations to sub-paths with router navigation or a
navigation to `/` carrying the target, which a small handler on the root page forwards with
`router.replace`; (b) a Capacitor setting or custom scheme handler that serves
`<path>/index.html`, if one exists in Capacitor 8. The `/?remove-database=…` and `/`
navigations already target the root and are fine. The chosen fix is recorded in the plan.

## 2. The Capacitor platform (`lib/platform/mobile`)

The browser stand-ins from sub-project 1 are replaced. Components keep calling `platform.*`
and never test the target themselves. Capacitor plugins have web implementations, so the export
still runs in a normal browser for the export e2e suite.

| Need | Implementation |
|---|---|
| Supabase session storage | `@capacitor/preferences` as the supabase-js `storage` adapter (async). Native storage, so clearing WebView data does not sign the user out |
| `connectivity$` | `@capacitor/network`: current status, then `networkStatusChange` |
| `foreground$` | `@capacitor/app`: `appStateChange` with `isActive` |
| `getDeviceId()` | A random id generated once and kept in Preferences |
| `getDeviceLabel()` | From `@capacitor/device` (model and OS). The interface returns a string synchronously; the builder reads the info once at start-up or makes the method async (the sync core is the only caller) |
| `requestPersistentStorage()` | Still calls `navigator.storage.persist()`; resolves true if unavailable |
| `saveFile()` (report) | `@capacitor/filesystem` writes the PDF to the cache folder, then `@capacitor/share` opens the share sheet. On iPad the stock plugin shows the sheet centred, which is accepted (my call: anchoring it to the button needs custom Swift that can't be tested before part B). Where sharing is unavailable (the browser export suite), it falls back to the existing download |
| Keep the screen awake | `@capacitor-community/keep-awake` (or the current equivalent plugin) |
| Haptics | `@capacitor/haptics` |
| App version | `@capacitor/app` `getInfo()` |
| Incoming links | `@capacitor/app` `appUrlOpen` (section 6) |
| Back button (Android) | `@capacitor/app` `backButton` (section 4) |
| Status bar, splash | `@capacitor/status-bar`, `@capacitor/splash-screen` |

New members on `Platform` (names are the builder's call): `keepAwake()` returning a release
function, `haptics.tap()` / `haptics.success()`, `appVersion()` (`null` on web), and a hook or
provider for the native listeners (links, back button). On web they are no-ops, except that
keep-awake uses the Screen Wake Lock API where the browser has it (my call: the web live match
benefits too).

ESLint: `@capacitor/*` imports stay confined to `lib/platform/` (rule from sub-project 1).

Google Analytics: `app/layout.tsx` renders it only when `platform.target === 'web'`, so the
mobile build never loads it.

## 3. Admin role and the FFVB import

### Database (one migration, run by the user)

- `profiles.role text not null default 'user'`, check `role in ('user', 'admin')`. Existing
  rows get `user`. Older app versions are unaffected (they never write `role`).
- A `before insert or update` trigger on `profiles` rejects a row whose `role` is set or
  changed by a request with the `anon` or `authenticated` role (read from the request's JWT
  claims). SQL run in the dashboard and the service role are allowed. Users still edit their
  name, language and favourites as today, including through upserts that send the unchanged
  `role`.
- Making the user an admin: `update public.profiles set role = 'admin' where id = '<user id>';`,
  run by the user in the dashboard.
- After the migration, `pnpm supabase:types` regenerates the types.

The migration must be checked against the live `profiles` policies and the sign-up trigger
that creates profiles (neither is in `supabase/migrations/`; they were created in the
dashboard). The plan includes a read-only SQL query for the user to run first.

### FFVB route (`app/api/import/ffvb/route.web.ts`)

- Stays at its current path, web target only.
- After the existing signed-in check, it reads the caller's own `profiles.role` with the
  caller's session (RLS applies) and returns 403 unless it is `admin`. The import itself keeps
  using the service-role client (it writes championship data shared by all clubs).

### FFVB button (`app/championships/view/page.tsx`)

Today it is disabled on both targets. New: rendered only when `platform.target === 'web'` and
the signed-in user's profile has `role = 'admin'`; enabled, calls the route, shows the result
in a toast. Hidden for everyone else.

## 4. Native features and app behaviour

### Live match page

- **Keep awake** while the live match page is mounted; released when leaving it.
- **Haptics** (phones; iPads have no vibration motor, so it does nothing there): a light tap
  when a point or a stat is recorded, a success pattern at the end of a set and of the match.
  Nowhere else in the app.
- **Landscape hint** (both targets, touch devices only): opening a live match in portrait shows
  a small dismissible hint to turn the device for the scoring layout. It disappears when the
  device turns, and stays dismissed for that match on that device. Nothing is locked; portrait
  keeps working.

### Android back button

Closes an open dialog or sheet first (my call: dispatch Escape, which Radix handles); otherwise
goes back in history; on the home page it closes the app. On the live match page, going back
goes through the existing leave-match flow, not around it.

### Bottom tab bar (installed app only)

Added 2026-10-22 at the user's request: the installed app (iOS and Android, phone and iPad) uses
a bottom tab bar instead of the header menu. The website is unchanged on every screen size, and
so is the export opened in a browser (the e2e export suite keeps the current navigation).
- Four tabs, the current navigation entries: Championships, Matches, Teams, Settings, each with
  its icon and label; the active tab follows the section (`/teams/view?id=…` → Teams).
- In the app the header keeps the logo (home), the sync indicator and sign-out; the hamburger
  menu and the header links are not rendered.
- Hidden on the live match page (the court needs the space; leaving goes through the existing
  leave flow and the Android back button) and while the on-screen keyboard is open.
- Sits above the home indicator / gesture bar (`env(safe-area-inset-bottom)`); page content is
  padded so nothing hides behind it.
- Tab links go through the existing leave guard like the header links.
- Decided by `platform.nativePlatform !== null` (my call: "the app" means the installed app, not
  the mobile build in a browser).

### Status bar and safe areas

The WebView draws under the status bar; the existing `viewportFit: 'cover'` and safe-area
insets keep content clear of notches in both orientations. Status bar style follows the app
theme.

### Icons and splash

- **Icon:** the smiling ball from `public/logo.png` on the logo's navy background, without the
  text ring, square, no transparency. Produced as one 1024×1024 source image, then all sizes
  (including the Android adaptive icon) generated with `@capacitor/assets`.
- **Splash:** the same ball on navy (no text). Light and dark variants identical.
- The in-app logo is not changed in this sub-project.

## 5. Old app versions

### Compatibility policy (written to `.claude/docs/`, referenced from `CLAUDE.md`)

From the first store release on:
1. A migration may only add: tables, columns that allow null or have a default, functions,
   policies that do not remove access an older app relies on.
2. Renaming or dropping a column, changing a function's parameters (`claim_match_scorer`,
   `get_match_scorer`, `delete_my_account`…), or tightening a policy happens in two releases:
   add the new form, raise `min_version` above every app version using the old form, then
   remove the old form.
3. `/api/v1` never changes incompatibly; a breaking change becomes `/api/v2` with v1 kept.
4. Every migration gets the question "does an app built three months ago still work?" in its
   header comment.

### Minimum-version check

- **Table `app_config`** (same migration as section 3): one row per platform (`ios`,
  `android`) with `min_version`, `latest_version` and `store_url` (null until the app is
  published). Readable by `anon` and `authenticated`, writable only from the dashboard. Not
  replicated to RxDB.
- **When:** mobile only, at start and when the app returns to the foreground, only when online.
  Offline, or if the request fails, nothing is shown.
- **Below `latest_version`:** a dismissible "Update available" banner.
- **Below `min_version`:** a full-screen "Please update" page with a button to `store_url`
  (hidden while null). A live match in progress is never interrupted: the page appears when the
  user leaves the live match page or at the next start.
- Updating from the store keeps the local database, so unsent changes upload after the update.
- Versions compare as dotted numbers (`1.4.10` > `1.4.9`); the app's version is the native
  version string from `appVersion()`.

Live updates (pushing new web code to installed apps outside the stores) are out of scope; the
hosted service is paid, and a self-hosted setup adds work and review risk.

## 6. Links into the app

- The listener for `appUrlOpen` maps an incoming `https://<web origin>/…` URL to an in-app
  route and navigates client-side (`router.push`), never by a full page load:
  - the new query-param routes as they are (`/matches/live?id=…`, `/auth/confirm?…`, …);
  - the old path forms (`/matches/<uuid>/live` and the other five from sub-project 1) mapped to
    their new routes, since the mobile export has no redirects;
  - anything else goes to `/`.
- Built and unit-tested now; it only receives links once part B configures the domain.
- **Association files** are served by the web deployment from settings, so no code change is
  needed when the values arrive:
  - `/.well-known/apple-app-site-association`: `applinks` for `<Team ID>.<bundle id>`, paths
    `/auth/*` and `/matches/*`;
  - `/.well-known/assetlinks.json`: the Android package and the signing certificate
    fingerprints;
  - server env vars (names are the builder's call, e.g. `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`,
    `ANDROID_PACKAGE`, `ANDROID_CERT_SHA256` as a comma-separated list); each file answers 404
    while its values are unset. Both are JSON with `Content-Type: application/json`, no
    redirect.
  - Whether Next 16 serves a route under `app/.well-known/` is checked; otherwise a web-only
    rewrite to an internal route.
- The native side of the links (iOS Associated Domains entitlement, Android intent filter with
  `autoVerify` for the host) needs the domain and is part B. The checklist lists the exact
  edits.
- Until then, an auth email opened on the phone opens the web app in the browser; the user then
  signs in inside the app. This is accepted for part A.

## 7. Settings that arrive later

| Setting | Where | Set in |
|---|---|---|
| Web and API origin | `NEXT_PUBLIC_WEB_ORIGIN`, `NEXT_PUBLIC_API_ORIGIN` (build), GitHub variables, Supabase site URL and redirect URLs | part B (domain) |
| CORS for the app | `API_CORS_ORIGINS` on the web server gets `capacitor://localhost,https://localhost` | part A (can be set now on the current deployment) |
| App id, display name | `capacitor.config.ts` | part B (name) |
| Association file values | server env vars (section 6) | part B (accounts, domain) |
| Store URLs, versions | `app_config` rows | part B |

`/api/v1` itself needs no code change: the report route already uses the CORS helper and
Bearer auth; only the allowed origins are added.

## 8. Privacy and store requirements prepared in part A

- **Privacy policy page** `/privacy` (both targets, public, five locales), linked from settings
  and the sign-in page. A draft written from what the app stores: email, first and last name,
  language, favourites, teams, players and match statistics entered by users, a per-install
  device id and device label (scorer claim), no analytics in the app, no advertising, no
  selling of data, Supabase as processor, account deletion in settings. The publisher's name and
  contact are placeholders the user fills in; the user reviews the text before part B.
- **iOS privacy manifest** `ios/App/App/PrivacyInfo.xcprivacy`: no tracking, no tracking
  domains, the collected data types above (linked to the user, app functionality only), and the
  required-reason API entries for what the app and its plugins use (at least `UserDefaults`
  through Preferences). Plugin-provided manifests are checked, not duplicated.
- **Store answers drafted** in the checklist: Apple privacy labels, Google Play data safety
  form, the account-deletion URL (`<web origin>/settings`), age rating notes.

## 9. CI

`.github/workflows/ci.yml` gains two jobs after the existing one (which produces `out/`):
- **Android:** Ubuntu, JDK as required by Capacitor 8, `cap sync android`, `./gradlew
  assembleDebug`, the APK uploaded as a build artifact (installable on an emulator or phone).
- **iOS:** a GitHub-hosted macOS runner with Xcode 26, `cap sync ios`, `xcodebuild` for the
  simulator SDK with code signing disabled. It proves the project compiles; it produces nothing
  installable.

The four GitHub repository variables from sub-project 1 must be set first (open item below).

## 10. Testing

- **Unit:** link mapping (new routes, old path forms, foreign URLs), version comparison and the
  banner / block decision, the mobile platform with mocked Capacitor plugins (session storage
  adapter, sync signals, device id kept), the FFVB route (401 signed out, 403 non-admin, 200
  admin with the import mocked), the landscape hint's show/dismiss rules.
- **E2E, web:** the full suite; new: the FFVB button is hidden for the non-admin test user.
- **E2E, export:** the existing export suite (browser, port 3200) still passes with the
  Capacitor platform in place, which proves the plugins' web fallbacks don't break the app.
- **Android manual checklist** (written in the repo, run on the emulator before calling part A
  done): the items of "Done when" 1, plus keep-awake (screen does not dim during a live match),
  rotation during a live match, and the update screen by setting `min_version` above the
  installed version.
- **iOS:** compile only in CI.

## 11. Part B checklist (written in part A, `docs/superpowers/notes/`)

In order, each with the exact files, settings and commands:
1. Pay and create the Apple Developer and Google Play accounts.
2. Choose the store name (no "For Dummies"), the bundle id / application id, and confirm the
   icon. Then replace the "For Dummies" wording everywhere the app shows it, before any
   TestFlight build: `APP_TITLE_LONG` in `app/layout.tsx`, `app/manifest.webmanifest`, the
   `messages/*/` files (all five locales), the in-app logo `public/logo.png`, and the
   `send-email` templates. Part A leaves these untouched (the name is decided later) and lists
   the exact occurrences found by search in this checklist.
3. Configure the domain: Vercel, `NEXT_PUBLIC_*` origins, GitHub variables, Supabase site URL
   and redirect URLs, `API_CORS_ORIGINS`.
4. iOS signing from Windows: certificate signing request with `openssl`, distribution
   certificate, App Store provisioning profile, App Store Connect API key, stored as GitHub
   secrets; a signed CI build uploaded to TestFlight; install on the iPad and iPhone.
5. Android signing: upload keystore, Play App Signing; both fingerprints in `assetlinks`.
6. Association values on the server; Associated Domains entitlement and Android intent filter.
7. iPad and iPhone testing round on TestFlight (the risk items listed under "Where this
   sub-project stops").
8. Privacy policy reviewed and published; privacy labels and data safety form filled.
9. Store listings: screenshots (iPad 13", iPhone 6.9", Android phone and tablet), description,
   languages, a demo account with data for App Review.
10. `app_config` rows with store URLs and versions.
11. Submit; plan one or two review rounds.

## Open items carried over from sub-project 1

Done in this sub-project or by the user alongside it:
- Set the four GitHub Actions repository variables (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN`); CI fails
  without them. Until the domain exists, the origins are the current deployment's address.
- Deploy the `send-email` edge function so emails link to `/auth/confirm`.
- Check that `20261015000000_account_deletion.sql` is applied (a read-only query in the plan).
- Remove `app/auth/callback/route.web.ts` (now, instead of one release later), after the
  `send-email` deploy.
- Production domain: part B.

## Out of scope

Google Analytics and consent (later, both targets); live updates; push notifications; the
in-app logo and the app's name; moving the FFVB import to `/api/v1` or to the app; offline
screens other than the live match; RxDB SQLite storage; a native e2e suite.
