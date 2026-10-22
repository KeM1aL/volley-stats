# Mobile App (Capacitor)

The installed app (Android and iOS, `appId` `com.volleystats.app`, name `VolleyStats`) is the `BUILD_TARGET=mobile` static export (`out/`) in a Capacitor 8 shell. The `android/` and `ios/` projects are committed. Design: `docs/superpowers/specs/2026-10-22-capacitor-app-design.md`. Store release (part B, once the accounts, domain and name exist): `docs/superpowers/notes/2026-10-22-store-release-checklist.md`. Manual test list: `docs/superpowers/notes/2026-10-22-android-manual-checklist.md`.

## Compatibility policy (old app versions)

Applies from the first store release on. Installed apps update when their owner decides, so the database and the web API must keep working for app versions released months ago.

1. A migration may only add: tables, columns that allow null or have a default, functions, policies that do not remove access an older app relies on.
2. Renaming or dropping a column, changing a function's parameters (`claim_match_scorer`, `get_match_scorer`, `delete_my_account`...), or tightening a policy happens in two releases: add the new form, raise `min_version` above every app version using the old form, then remove the old form.
3. `/api/v1` never changes incompatibly; a breaking change becomes `/api/v2` with v1 kept.
4. Every migration gets the question "does an app built three months ago still work?" in its header comment.

`min_version` lives in the `app_config` table (see "Minimum-version check" below). The rule 4 header is a comment on the first line of the migration file that answers it, e.g. `-- Backward compatible: adds a defaulted column and a new table; older apps never write role.` (see `supabase/migrations/20261023000000_app_role_and_config.sql`).

## Building and running the Android app (Windows)

Prerequisites: Android Studio with an AVD named `Pixel_9_Pro_XL` (the `cap:android` script targets it), the Android SDK, and **JDK 21** (the Gradle 8.14 wrapper fails on JDK 25 with "Unsupported class file major version 69").

```bash
export JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"   # Git Bash: "/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
unset NoDefaultCurrentDirectoryInExePath     # Git Bash only: otherwise Capacitor's call to gradlew through cmd.exe fails ("'gradlew' is not recognized")
```

Build values for an emulator that talks to a web server on the PC (the emulator sees the PC at `10.0.2.2`):

```bash
# 1. The web server the app calls (reports, FFVB): CORS must allow the app's origin (https://localhost) and the browser export suite (http://localhost:3200)
pnpm build
API_CORS_ORIGINS=https://localhost,http://localhost:3200 pnpm start -p 3100

# 2. The export + native sync + run on the emulator (CAP_DEV_HTTP also on cap:android: cap run rewrites capacitor.config.json again)
export NEXT_PUBLIC_API_ORIGIN=http://10.0.2.2:3100 NEXT_PUBLIC_WEB_ORIGIN=http://10.0.2.2:3100 CAP_DEV_HTTP=1
pnpm cap:sync        # build-mobile -> sync-app-version -> cap sync
pnpm cap:android     # cap run android --target Pixel_9_Pro_XL
```

- `CAP_DEV_HTTP=1` ([capacitor.config.ts](../../capacitor.config.ts)) allows cleartext HTTP so the app can reach `http://10.0.2.2:3100`. Never set it for a release build.
- `pnpm build` (web) and `pnpm build:mobile` both write `.next/`: do not run a mobile build while `pnpm start` is serving, and rebuild the web app before starting the server again.
- The first Gradle build can take more than ten minutes (dependency downloads). `pnpm cap:android` may keep running after the app has started: check `adb shell pm list packages | grep volleystats`.
- Sign-in, the live match, offline mode and the share sheet all work on the emulator. Haptics do not vibrate there.
- Debugging the WebView: `adb forward tcp:19222 localabstract:webview_devtools_remote_<app pid>` (find the socket with `adb shell cat /proc/net/unix | grep webview_devtools`), then open `http://localhost:19222` in Chrome, or attach Playwright with `chromium.connectOverCDP('http://localhost:19222')`. Port 9222 fails with error 10013 on the developer's PC (Windows excluded port range).
- Debug builds log plugin calls to logcat, including `Preferences` reads and writes, which contain the Supabase session token. Never share a debug logcat, and see `loggingBehavior` in the store checklist.

### How full-page navigations behave

Capacitor's local server answers every path without a file extension with the root `index.html` (Android `WebViewLocalServer`, iOS `CapacitorRouter`). Client-side navigation is unaffected, but a full page load of a sub-path would show the landing page. Details and measurements: `docs/superpowers/notes/2026-10-22-capacitor-routing.md`. The app therefore:
- never does a full-page navigation to a sub-path directly: use `platform.hardNavigate(path)`, which on mobile goes to `/?to=<path>`;
- renders [components/native/boot-redirect.tsx](../../components/native/boot-redirect.tsx) on the root page: it opens the `?to=` target, and also the URL of a reload of a sub-path, with `router.replace`. A session-storage marker (the loop guard) allows one forward per target within a few seconds, so a path the router cannot open ends on the landing page under `/` instead of reloading forever.

### App version

The app version is `package.json` `version`. `scripts/sync-app-version.mjs` stamps it into the native projects: Android `versionName` / `versionCode` (`android/app/build.gradle`), iOS `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` (`ios/App/App.xcodeproj/project.pbxproj`). It runs inside `pnpm cap:sync` and in CI before `cap sync`. `versionCode = major * 10000 + minor * 100 + patch`, so `minor` and `patch` must be 99 or less (the script throws otherwise). Bumping `package.json` without running `pnpm cap:sync` leaves the native projects on the old version.

### Icons and splash

`pnpm app:assets` builds the source images from `public/logo.png` (`scripts/make-app-assets.mjs`, into `assets/`) and runs `@capacitor/assets generate --android --ios`. The flags matter: without them the tool also writes a PWA `icons/` folder and `public/manifest.webmanifest` into the repo. The tool reformats `android/app/src/main/AndroidManifest.xml`: **revert it after every run** (`git checkout android/app/src/main/AndroidManifest.xml`).

## CI

[.github/workflows/ci.yml](../../.github/workflows/ci.yml) has three jobs. `checks` (lint baseline, unit tests, web build, `build:mobile`, `check:export`) uploads `out/`. `android` (Ubuntu, JDK 21) stamps the version, runs `cap sync android` and `./gradlew assembleDebug`, and uploads the debug APK. `ios` (`macos-26`, Xcode 26) stamps the version, runs `cap sync ios` and an unsigned `xcodebuild` for the simulator SDK, then checks that the app's own `PrivacyInfo.xcprivacy` is at the root of `App.app`. The iOS job proves the project compiles; nothing installable comes out of it. The four GitHub repository variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN`) must be set.

## Native features and where they live

All device access sits behind `lib/platform` (`NativeFeatures` in [lib/platform/types.ts](../../lib/platform/types.ts)); `@capacitor/*` imports are confined to `lib/platform/` by ESLint. `web/native.ts` has browser equivalents or no-ops, `mobile/native.ts` the Capacitor plugins (only when `Capacitor.isNativePlatform()`; the export opened in a browser behaves like web).

| Feature | Where |
|---|---|
| Auth session in native storage | `lib/platform/mobile/storage.ts` (`@capacitor/preferences` as the supabase-js storage) |
| Sync signals, device id and label | `lib/platform/mobile/sync.ts` (Network, App, Device, Preferences) |
| Report share sheet | `lib/platform/mobile/files.ts` (`saveFile`: Filesystem cache file, then Share; browser fallback is a download; iPad shows the sheet centred) |
| Keep the screen awake | `hooks/use-keep-awake.ts`, used by the live match page (`platform.keepAwake()`: plugin in the app, Screen Wake Lock in browsers) |
| Haptics | `lib/matches/haptics.ts` decides the pattern (tap / success), the live match page calls `platform.haptics`. Live match only |
| Landscape hint | `components/matches/live/landscape-hint.tsx`, `lib/matches/landscape-hint.ts`, `hooks/use-landscape.ts` (both targets, touch devices; dismissal remembered per match) |
| Incoming links and Android back button | `components/native/native-bridge.tsx` (renders nothing; `appRouteFromUrl` in `lib/routes.ts` maps links, `lib/native/back-action.ts` decides the back button) |
| Update banner / block | `components/native/update-gate.tsx`, `lib/api/app-config.ts`, `lib/utils/version.ts` |
| Bottom tab bar | `components/navigation/bottom-tab-bar.tsx`, `lib/native/tab-bar.ts`, `components/navigation/use-text-entry-keyboard.ts` |
| Status bar, splash, safe areas | `platform.watchStatusBar()`, `@capacitor/splash-screen` (config in `capacitor.config.ts`), `viewportFit: 'cover'` |
| Analytics | Web only, through the `platform.Analytics` seam (a no-op component in the mobile build, so the script is not in the export) |

### Android back button

Subscribing replaces the system behaviour, so `backAction` decides every case, in this order: (1) an open dialog or sheet closes (Escape is dispatched, which Radix handles); (2) an active leave guard (live match with unsent or unfinished work) asks through the existing leave flow, then goes back, or home when the page was the first history entry; (3) on the home page the app exits; (4) otherwise back when there is history; (5) otherwise home.

### Bottom tab bar

Only in the installed app (`platform.nativePlatform !== null`); the website and the export opened in a browser keep the header navigation. Four tabs (Championships, Matches, Teams, Settings); the active one follows the section. Hidden on the live match page, on the sign-in pages and while a text field has the on-screen keyboard open. The tab links go through the leave guard. Known limit: `useKeyboard()` does not detect the Android WebView keyboard (the WebView resizes the page instead), so the tab bar uses `useTextEntryKeyboard` (a focused text field plus a viewport that lost at least 100 px).

### Minimum-version check (update gate)

Table `app_config`: one row per platform (`ios`, `android`) with `min_version`, `latest_version`, `store_url` (null until published); readable by `anon` and `authenticated`, writable only from the dashboard, not replicated to RxDB. `UpdateGate` reads the row for `platform.nativePlatform` at start and when the app returns to the foreground, only online; a failed read changes nothing. Below `latest_version`: a dismissible banner. Below `min_version`: a full-screen "please update" page with a button to `store_url` (hidden while null). Neither shows over the live match page: they appear when it is left. Versions compare as dotted numbers. To test: update the row in the dashboard (`update public.app_config set min_version = '9.0.0' where platform = 'android';`) and bring the app to the foreground.

### Admin role

`profiles.role` (`user` / `admin`) is protected by the trigger `protect_profile_role`: a request with the `anon` or `authenticated` role cannot set or change it; SQL in the dashboard and the service role can. Making a user an admin: `update public.profiles set role = 'admin' where id = '<user id>';` in the dashboard. The FFVB import (`app/api/import/ffvb/route.web.ts`, web target only) returns 401 when signed out and 403 to non-admins (`lib/server/admin.ts`), and its button on the championship page shows only to admins on the web build.

### Link association files

Served by the web deployment from environment variables (no code change when the values arrive); each answers 404 while its values are unset, JSON, no redirect:
- `/.well-known/apple-app-site-association` (`app/.well-known/apple-app-site-association/route.web.ts`): `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`; paths `/auth/*` and `/matches/*`.
- `/.well-known/assetlinks.json` (`app/.well-known/assetlinks.json/route.web.ts`): `ANDROID_PACKAGE`, `ANDROID_CERT_SHA256` (comma-separated fingerprints).

The native side (iOS Associated Domains entitlement, Android intent filter with `autoVerify`) needs the domain and is part B. Until then an auth email opens the web app in the browser.

### Migrations of this sub-project

- `20261023000000_app_role_and_config.sql` (already applied): `profiles.role`, `protect_profile_role` trigger, `app_config` table with an `ios` and an `android` row.
- `20261023000100_protect_profile_role_empty_claims.sql`: replaces the trigger function so an empty `request.jwt.claims` setting reads as "no claims". **Must be run by the user in the Supabase dashboard** (pending until confirmed).

Regenerate the types with `pnpm supabase:types` after a schema change.

## Known limits

- iOS has never been run: it only compiles in CI. iOS-specific problems (WebView storage, links, keyboard, safe areas) appear in the TestFlight round of part B.
- `useKeyboard()` does not detect the Android WebView keyboard; the tab bar uses `useTextEntryKeyboard`.
- Debug builds log plugin calls (the Preferences session token appears in logcat); see `loggingBehavior` in the store checklist.
- Haptics do nothing on the emulator and on iPads (no vibration motor).
- No live updates: a new web build only reaches installed apps through a store release.
- Open item: delete `app/auth/callback/route.web.ts` and its mentions in the docs once the `send-email` edge function is deployed (emails then link to `/auth/confirm`).
