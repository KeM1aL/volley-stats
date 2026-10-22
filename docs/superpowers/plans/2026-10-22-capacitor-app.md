# Capacitor App and Mobile API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the `BUILD_TARGET=mobile` static export in a Capacitor 8 shell (Android runnable on the developer's emulator, iOS compiled in CI), with native platform implementations, live-match native features, an admin-only FFVB import, a minimum-version check, link plumbing, privacy material and a release checklist for the store step.

**Architecture:** `capacitor.config.ts` bundles `out/` into committed `android/` and `ios/` projects. Everything native stays behind `lib/platform` (`@capacitor/*` imports are confined there by ESLint); components use new `Platform` members and small pure helpers that carry the decisions (haptic choice, back-button action, link mapping, update status) so they are unit-tested in Node. The server side adds a `profiles.role` admin check on the web-only FFVB route and two association-file routes driven by env vars.

**Tech Stack:** Capacitor 8 (`@capacitor/core`, `cli`, `android`, `ios`, `app`, `network`, `device`, `preferences`, `filesystem`, `share`, `haptics`, `status-bar`, `splash-screen`, `@capacitor/assets`), a keep-awake plugin compatible with Capacitor 8, Next.js 16.3 static export, React 19, TypeScript 6, next-intl 4, supabase-js, RxDB 17, Vitest, Playwright, GitHub Actions (Ubuntu + macOS runners), Android SDK 36, Xcode 26 (CI only).

**Spec:** [docs/superpowers/specs/2026-10-22-capacitor-app-design.md](../specs/2026-10-22-capacitor-app-design.md) (parents: [decision record](../specs/2026-10-09-mobile-app-decision.md), [static-export readiness](../specs/2026-10-14-static-export-readiness-design.md)). Read the spec before starting; section numbers below (§n) refer to it.

## Global Constraints

- Branch `feature/capacitor-app`. Commit after every task; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never merge to `main`; never push without asking the user first.
- **SQL:** never run SQL or apply migrations. Write the file, give the user the SQL (and the read-only checks) and wait for their pasted result. The Supabase project is shared with production: every migration is backward compatible.
- Never write secret values into code, docs, plans, commits or test output; name env variables only. No `SUPABASE_SERVICE_ROLE_KEY` in the mobile build (`pnpm check:export` scans for it).
- `@capacitor/*` imports only inside `lib/platform/` (existing ESLint rule; `capacitor.config.ts` gets an override in Task 1). Components never test the target themselves except through `platform.*`.
- Core folders `lib/{api,auth,commands,importers,keyboard,matches,rxdb,stats,templates,types,utils}` import no React, Next or Capacitor.
- Every new UI string exists in `messages/en`, `fr`, `es`, `it`, `pt` (`tests/unit/i18n/locale-parity.test.ts`, `pnpm i18n:check`).
- Live match writes stay in RxDB; no API-layer calls from the live page.
- Unit tests: `pnpm test` (Vitest, node environment, `tests/unit/**/*.test.ts`; `@platform-impl` resolves to the web implementation, so import mobile modules by path and `vi.mock('@capacitor/…')`).
- Lint gate: `node scripts/lint-report.mjs && node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json` prints "No new lint errors compared with baseline." Typecheck: `npx tsc --noEmit` gains no errors.
- E2E on this Windows machine: no `next dev` running. Web: `pnpm build && pnpm start -p 3100` (background), then `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e <args>`. Export: see `.claude/docs/02-architecture.md` (web server with `API_CORS_ORIGINS=http://localhost:3200`, `pnpm serve:mobile`, `E2E_TARGET=mobile`). Stop servers by PID only: `netstat -ano | grep ":3100 " | grep LISTEN` then `taskkill //PID <pid> //F //T`; never `taskkill /IM node.exe`. Per task run only the touched specs or `pnpm test:e2e:quick`; the full suite runs in Task 13.
- Android on this PC: SDK at `%LOCALAPPDATA%\Android\Sdk` (platform 36, emulator AVD `Pixel_9_Pro_XL`), Android Studio's JBR is JDK 25. `ANDROID_HOME` and `JAVA_HOME` are not set: set them per command (`ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"`). Gradle 8.14 does not run on JDK 25: if Gradle fails on the JDK, ask the user to install Temurin JDK 21 and use it as `JAVA_HOME`.
- Emulator development build: `NEXT_PUBLIC_API_ORIGIN=http://10.0.2.2:3100 NEXT_PUBLIC_WEB_ORIGIN=http://10.0.2.2:3100 CAP_DEV_HTTP=1`, with the web server started with `API_CORS_ORIGINS=https://localhost,http://localhost:3200`. Release and CI builds never set `CAP_DEV_HTTP`.
- Working app id `com.volleystats.app`, display name `VolleyStats` (§1). Do not change any "For Dummies" wording (part B, §11).

## Review Focus

1. **The version check never blocks without a reason**: offline, `app_config` unreachable, a missing row, or a malformed version string must all yield no banner and no block; a block on the live match page waits until the user leaves it. Pinned by `updateUi` tests (Task 8).
2. **An incoming link that is foreign, malformed or old-style** (`https://evil.example/matches/live?id=…`, `not a url`, `https://<web>/matches/<UPPERCASE-UUID>/live?team=x`, `https://<web>/auth/confirm?token_hash=…&type=recovery`) maps to `/`, `/`, `/matches/live?id=<uuid>&team=x` and the confirm route with its query intact. Pinned by `appRouteFromUrl` tests (Task 6).
3. **Android back with a dialog open on the live match page** closes the dialog and never leaves the match; back on the live page with no dialog asks through the leave guard. Pinned by `backAction` tests (Task 6) and the Android checklist (Task 13).
4. **A normal user editing their profile after the role migration** still saves name, language and favourites (the update sends the unchanged `role` or none), while setting `role` from the client fails. Pinned by the verification SQL (Task 7) and `05-settings` e2e (Task 7).
5. **Saving the report where native sharing is unavailable** (the export served in a browser, or `Share` rejected/cancelled) still downloads the file or fails silently on cancel, never throws an error toast for a user cancel. Pinned by `saveFile` tests (Task 3).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `capacitor.config.ts`, `android/`, `ios/` | Native shell and its config | 1 |
| `scripts/cap-sync.mjs` | Build the export, stamp the version, `cap sync` | 1, 8 |
| `docs/superpowers/notes/2026-10-22-capacitor-routing.md` | Result of the routing check | 1 |
| `lib/routes.ts` (`bootRedirectTarget`, `appRouteFromUrl`), `components/native/boot-redirect.tsx` | Full-page navigation fix, link mapping | 2, 6 |
| `lib/platform/types.ts`, `lib/platform/web/index.ts`, `lib/platform/mobile/{index,storage,sync,files,native}.ts` | Platform members and native implementations | 3 |
| `assets/icon-only.png`, `assets/splash.png`, `scripts/make-app-assets.mjs` | Icon and splash sources | 4 |
| `lib/matches/haptics.ts`, `lib/matches/landscape-hint.ts`, `hooks/use-keep-awake.ts`, `components/matches/live/landscape-hint.tsx` | Live match native features | 5 |
| `lib/native/back-action.ts`, `components/native/native-bridge.tsx`, `lib/server/app-links.ts`, `app/.well-known/**/route.web.ts` | Back button, incoming links, association files | 6 |
| `supabase/migrations/20261023000000_app_role_and_config.sql` | `profiles.role`, trigger, `app_config` | 7 |
| `lib/utils/version.ts`, `lib/api/app-config.ts`, `components/native/update-gate.tsx`, `scripts/sync-app-version.mjs` | Minimum-version check | 8 |
| `lib/server/admin.ts`, `app/api/import/ffvb/route.web.ts`, `components/championships/ffvb-import-button.tsx` | Admin-only FFVB import | 9 |
| `components/analytics.tsx`, deleted `app/auth/callback/route.web.ts` | Analytics web-only, old callback removed | 10 |
| `app/privacy/page.tsx`, `messages/*/privacy.json`, `ios/App/App/PrivacyInfo.xcprivacy` | Privacy policy and manifest | 11 |
| `.github/workflows/ci.yml` | Android and iOS CI jobs | 12 |
| `lib/native/tab-bar.ts`, `components/navigation/{nav-items.ts,bottom-tab-bar.tsx}` | Bottom tab bar in the installed app | 14 |
| `.claude/docs/11-mobile-app.md`, `docs/superpowers/notes/2026-10-22-*.md`, `CLAUDE.md` | Compatibility policy, checklists, docs | 13 |

---

### Task 1: Capacitor shell, Android project, routing check

**Files:**
- Modify: `package.json` (deps + scripts), `eslint.config.mjs` (override for `capacitor.config.ts`), `.gitignore`
- Create: `capacitor.config.ts`, `scripts/cap-sync.mjs`, `android/` (generated), `ios/` (generated), `docs/superpowers/notes/2026-10-22-capacitor-routing.md`

**Interfaces:**
- Produces: `pnpm cap:sync` (runs `pnpm build:mobile`, then `npx cap sync`), `pnpm cap:android` (`npx cap run android --target Pixel_9_Pro_XL`); `capacitor.config.ts` with `appId: 'com.volleystats.app'`, `appName: 'VolleyStats'`, `webDir: 'out'`; when `process.env.CAP_DEV_HTTP === '1'`: `server: { cleartext: true }`, `android: { allowMixedContent: true }`.

- [ ] **Step 1: Install** `@capacitor/core`, `@capacitor/android`, `@capacitor/ios` (dependencies) and `@capacitor/cli` (devDependency), latest 8.x. Check `npm view @capacitor/core version` is 8.x.
- [ ] **Step 2: Write `capacitor.config.ts`** with the values above. Add an ESLint override so `capacitor.config.ts` may import `@capacitor/cli` (type only). Write `scripts/cap-sync.mjs` (Node, cross-OS like `scripts/build-mobile.mjs`) and the two scripts.
- [ ] **Step 3: Add the platforms.** `npx cap add android`. Then `npx cap add ios` (SPM, the Capacitor 8 default). If the CLI refuses on Windows, leave `ios/` for Task 12, which generates it on a macOS runner (record that in the routing note). Ensure `android/` build outputs (`android/app/build`, `.gradle`, `local.properties`) and `ios/App/build` are git-ignored (the generated `.gitignore` files usually cover them).
- [ ] **Step 4: Build and run on the emulator.** Start the web server (`API_CORS_ORIGINS=https://localhost,http://localhost:3200 pnpm start -p 3100` after `pnpm build`), then `NEXT_PUBLIC_API_ORIGIN=http://10.0.2.2:3100 NEXT_PUBLIC_WEB_ORIGIN=http://10.0.2.2:3100 CAP_DEV_HTTP=1 pnpm cap:sync` and `pnpm cap:android` (with `ANDROID_HOME`, `JAVA_HOME` set; see Global Constraints for JDK 25).
Expected: the app opens on the landing page; sign-in with the e2e test user works; the matches list loads.
- [ ] **Step 5: Check full-page loads on sub-paths** (§1 "Verify first"). In Chrome `chrome://inspect` → the app's WebView console, run `location.assign('/auth/?account-deleted=1')`, then on a team page run `location.reload()`.
Expected to learn: whether the auth page (and the team page) render, or the landing page's HTML is served under the sub-path URL. Write the result, the Capacitor version, and the chosen fix ("none needed" or option (a) of §1) in `docs/superpowers/notes/2026-10-22-capacitor-routing.md`.
- [ ] **Step 6: Gates** — `pnpm test`, lint gate, `npx tsc --noEmit`, `pnpm build:mobile && pnpm check:export`.
- [ ] **Step 7: Commit** — `feat(mobile): Capacitor 8 shell with Android and iOS projects`.

### Task 2: Full-page navigation on mobile

Skip this task (mark it done with a note) if Task 1 found that sub-path pages load correctly.

**Files:**
- Modify: `lib/routes.ts`, `lib/platform/types.ts`, `lib/platform/web/index.ts`, `lib/platform/mobile/index.ts`, `components/settings/delete-account-card.tsx:161`, `app/page.tsx`
- Create: `components/native/boot-redirect.tsx`
- Test: `tests/unit/routes/boot-redirect.test.ts`

**Interfaces:**
- Produces: `bootRedirectTarget(search: string): string | null` in `lib/routes.ts`: reads `to` from a query string; returns it only if it starts with a single `/`, has no `://`, backslash or control characters, and is not under `/api/` or `/_next/` (unlike `isSafeRedirectTarget`, `/auth…` is allowed). `Platform.hardNavigate(path: string): void`: web `window.location.assign(path)`; mobile `window.location.assign('/?to=' + encodeURIComponent(path))`. `<BootRedirect />` (rendered by `app/page.tsx` inside `Suspense`): when `bootRedirectTarget(location.search)` is non-null, `router.replace(target)`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("bootRedirectTarget", () => {
  it("returns an in-app path, auth pages included", () => {
    expect(bootRedirectTarget("?to=%2Fauth%3Faccount-deleted%3D1")).toBe("/auth?account-deleted=1");
    expect(bootRedirectTarget("?to=%2Fteams%2Fview%3Fid%3Dabc")).toBe("/teams/view?id=abc");
  });
  it("rejects missing, external and technical targets", () => {
    for (const search of ["", "?to=", "?to=%2F%2Fevil.com", "?to=https%3A%2F%2Fevil.com", "?to=%2F%5Cevil.com", "?to=%2Fapi%2Fv1%2Fx", "?to=%2F_next%2Fx"])
      expect(bootRedirectTarget(search)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `pnpm test tests/unit/routes/boot-redirect.test.ts` — FAIL (not exported).
- [ ] **Step 3: Implement** `bootRedirectTarget`, `hardNavigate` on both platforms, `BootRedirect`, and replace the `window.location.assign(…"/auth?account-deleted=1"…)` call with `platform.hardNavigate("/auth?account-deleted=1")`. Leave `/?remove-database=…` and `window.location.href = "/"` as they are (root URLs).
- [ ] **Step 4: Run** the unit test (PASS); `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/13-account-deletion.spec.ts` on web — PASS.
- [ ] **Step 5: Verify on the emulator**: rebuild with `pnpm cap:sync`, run `location.assign('/?to=' + encodeURIComponent('/auth?account-deleted=1'))` in the WebView console → the auth page with the "account deleted" message.
- [ ] **Step 6: Commit** — `fix(mobile): full-page navigations go through the root page in the app`.

### Task 3: Native platform implementations

**Files:**
- Modify: `lib/platform/types.ts`, `lib/platform/web/index.ts`, `lib/platform/mobile/index.ts`, `lib/rxdb/sync/platform/types.ts` (doc comment only), `package.json`
- Create: `lib/platform/mobile/storage.ts`, `lib/platform/mobile/sync.ts`, `lib/platform/mobile/files.ts`, `lib/platform/mobile/native.ts`, `lib/platform/web/native.ts`
- Test: `tests/unit/platform/mobile-storage.test.ts`, `tests/unit/platform/mobile-sync.test.ts`, `tests/unit/platform/mobile-files.test.ts`

**Interfaces:**
- Produces (new `Platform` members, used by Tasks 5, 6, 8):
  ```ts
  nativePlatform: "ios" | "android" | null;          // null on web and in a browser
  keepAwake(): Promise<() => Promise<void>>;         // returns the release function
  haptics: { tap(): Promise<void>; success(): Promise<void> };
  appVersion(): Promise<string | null>;              // native version string; null on web/browser
  onForeground(listener: () => void): () => void;    // returns unsubscribe
  onAppUrlOpen(listener: (url: string) => void): () => void;
  onBackButton(listener: (canGoBack: boolean) => void): () => void; // no-op on web
  exitApp(): void;                                    // no-op on web
  ```
- `createPreferencesStorage(): { getItem(key): Promise<string | null>; setItem(key, value): Promise<void>; removeItem(key): Promise<void> }` (supabase-js `storage`).
- `createNativeSyncPlatform(): SyncPlatform` — `connectivity$` from `Network.getStatus()` then `networkStatusChange` (distinct); `foreground$` from `App` `appStateChange` with `isActive`; `getDeviceId()` kept in Preferences under `volleystats:device-id`; `getDeviceLabel()` returns `"<model> · iOS"` / `"<model> · Android"` from `Device.getInfo()` read once at creation, `deviceLabelFromUserAgent(navigator.userAgent)` until it resolves; `requestPersistentStorage()` as in `lib/platform/shared/sync.ts`.
- `saveFileNative(data: Blob, fileName: string): Promise<void>` — if `Capacitor.isNativePlatform()` is false → `saveBlob`; else `Filesystem.writeFile` (base64, `Directory.Cache`) then `Share.share({ files: [uri], title: fileName })`; a share cancellation (error message containing "cancel", case-insensitive) resolves silently, other errors reject.
- Web implementations: `nativePlatform: null`; `keepAwake` uses `navigator.wakeLock.request('screen')` when available (release = `sentinel.release()`), else a no-op release; haptics no-ops; `appVersion` → `null`; `onForeground` via `visibilitychange`; `onAppUrlOpen`/`onBackButton` return no-op unsubscribes; `exitApp` no-op.
- Mobile `index.ts`: every member above guarded with `Capacitor.isNativePlatform()` so the export in a browser behaves like web (the export e2e suite relies on it); `createSupabaseClient` uses `createPreferencesStorage()` when native, `localStorage` otherwise; `createSyncPlatform` = `createNativeSyncPlatform` when native, `createWebPlatform` otherwise.

- [ ] **Step 1: Install** `@capacitor/app`, `@capacitor/network`, `@capacitor/device`, `@capacitor/preferences`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/haptics`, and a keep-awake plugin whose `peerDependencies` accept `@capacitor/core` 8 (check `npm view @capacitor-community/keep-awake peerDependencies`; otherwise `@capgo/capacitor-keep-awake` or another maintained one; name the choice in the commit message).
- [ ] **Step 2: Write the failing tests** (mock each plugin with `vi.mock`):

```ts
// mobile-storage.test.ts
it("reads, writes and removes through Preferences", async () => {
  const storage = createPreferencesStorage();
  await storage.setItem("sb-token", "v");
  expect(Preferences.set).toHaveBeenCalledWith({ key: "sb-token", value: "v" });
  vi.mocked(Preferences.get).mockResolvedValueOnce({ value: null });
  expect(await storage.getItem("missing")).toBeNull();
});

// mobile-sync.test.ts
it("emits the current network status, then changes, without repeats", async () => { /* getStatus connected:true, listener fires false, false, true → [true, false, true] */ });
it("emits foreground only when the app becomes active", async () => { /* appStateChange isActive false then true → one emission */ });
it("generates the device id once and keeps it", async () => { /* two getDeviceId() calls → one Preferences.set, same value, UUID v4 shape */ });
it("labels the device from Device.getInfo", async () => { /* { model: "iPad14,1", operatingSystem: "ios" } → "iPad14,1 · iOS" after resolution */ });

// mobile-files.test.ts
it("downloads in a browser", async () => { /* isNativePlatform false → saveBlob called, Share not called */ });
it("writes to the cache folder and opens the share sheet", async () => { /* writeFile with Directory.Cache, Share.share with the returned uri */ });
it("treats a cancelled share as success", async () => { /* Share.share rejects "Share canceled" → resolves */ });
it("rejects other share errors", async () => { /* rejects "boom" → rejects */ });
```

- [ ] **Step 3: Run** `pnpm test tests/unit/platform` — the new tests FAIL.
- [ ] **Step 4: Implement** the modules and the new members on both platforms per Interfaces. `tests/unit/helpers/fake-platform.ts` is a `SyncPlatform` fake and needs no change.
- [ ] **Step 5: Run** `pnpm test` — PASS; lint gate; `npx tsc --noEmit`.
- [ ] **Step 6: Export e2e still green** (Review Focus 5): web server on 3100 with `API_CORS_ORIGINS=http://localhost:3200`, `pnpm build:mobile && pnpm serve:mobile`, then `CI=1 BASE_URL=http://localhost:3200 E2E_TARGET=mobile E2E_API_URL=http://localhost:3100 npx playwright test --project=core --project=live --project=stats` — PASS.
- [ ] **Step 7: Emulator check**: `pnpm cap:sync && pnpm cap:android`; sign in, kill and reopen the app → still signed in; airplane mode (`adb shell cmd connectivity airplane-mode enable`) → the sync badge shows offline; disable → it resumes.
- [ ] **Step 8: Commit** — `feat(mobile): Capacitor implementations behind lib/platform`.

### Task 4: Status bar, splash and icons

**Files:**
- Create: `scripts/make-app-assets.mjs`, `assets/icon-only.png`, `assets/icon-foreground.png`, `assets/icon-background.png`, `assets/splash.png`, `assets/splash-dark.png`
- Modify: `package.json`, `capacitor.config.ts`, `lib/platform/mobile/native.ts` (status bar style at start-up), generated files under `android/app/src/main/res/` and `ios/App/App/Assets.xcassets/`

**Interfaces:**
- Consumes: `public/logo.png` (2048×2048).
- Produces: `pnpm app:assets` = `node scripts/make-app-assets.mjs && npx @capacitor/assets generate`.

- [ ] **Step 1: Install** `@capacitor/status-bar`, `@capacitor/splash-screen` (dependencies), `@capacitor/assets` and `sharp` (devDependencies; `sharp` may need adding to `allowBuilds` in `pnpm-workspace.yaml`).
- [ ] **Step 2: Write `scripts/make-app-assets.mjs`**: read the navy of the logo ring by sampling `public/logo.png` at (1024, 150); crop the ball (the circle centred near (1026, 1026), radius about 370 px — check visually and adjust so the black outline is kept whole); write `assets/icon-only.png` (1024×1024, navy background, ball scaled to about 70% of the width, no alpha channel), `assets/icon-foreground.png` (1024×1024, transparent, ball at about 55% for the adaptive-icon safe zone), `assets/icon-background.png` (1024×1024 navy), `assets/splash.png` and `assets/splash-dark.png` (2732×2732 navy, ball at about 20%). No text from the logo in any output (§4, trademark).
- [ ] **Step 3: Generate** with `pnpm app:assets`; open `assets/icon-only.png` and `assets/splash.png` to check them by eye (ball whole, centred, no ring text).
- [ ] **Step 4: Splash and status bar config**: `SplashScreen` `launchAutoHide: true`, `backgroundColor` the sampled navy; at start-up (native only) `StatusBar.setOverlaysWebView({ overlay: true })` and the style following the `dark` class on `<html>` (watch it with a `MutationObserver`).
- [ ] **Step 5: Emulator check**: icon in the launcher, splash on cold start, status bar readable in light and dark themes, content clear of the status bar and the gesture bar in portrait and landscape (rotate with the emulator toolbar).
- [ ] **Step 6: Commit** — `feat(mobile): app icon, splash screen and status bar`.

### Task 5: Live match native features

**Files:**
- Create: `lib/matches/haptics.ts`, `lib/matches/landscape-hint.ts`, `hooks/use-keep-awake.ts`, `components/matches/live/landscape-hint.tsx`
- Modify: `app/matches/live/page.tsx` (`onPlayerStatRecorded` ~l.648, `onPointRecorded` ~l.673, render), `messages/*/matches.json` (or the namespace the live page uses)
- Test: `tests/unit/matches/haptics.test.ts`, `tests/unit/matches/landscape-hint.test.ts`

**Interfaces:**
- Consumes: `platform.keepAwake()`, `platform.haptics` (Task 3).
- Produces: `hapticFor(previous: MatchState, next: MatchState): "tap" | "success"` — `"success"` when `next.match.status === "completed"` and `previous.match.status !== "completed"`, or when `next.currentSet` differs from `previous.currentSet` by id or its status became `"completed"`; `"tap"` otherwise. `shouldShowLandscapeHint({ portrait, coarsePointer, dismissed }: { portrait: boolean; coarsePointer: boolean; dismissed: boolean }): boolean` = `portrait && coarsePointer && !dismissed`. `landscapeHintKey(matchId: string): string` = `` `volleystats:landscape-hint-dismissed:${matchId}` ``. `useKeepAwake(active: boolean): void`.

- [ ] **Step 1: Write the failing tests**: `hapticFor` — a point mid-set → `"tap"`; the point that completes a set → `"success"`; the point that completes the match → `"success"`; a stat that changes nothing in sets → `"tap"`. Build states with `tests/unit/helpers/fixtures.ts`. `shouldShowLandscapeHint` — the 8 combinations, true only for `(true, true, false)`.
- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Implement** the helpers; `useKeepAwake(active)` acquires on `active` true and releases on false or unmount (ignore errors; log a warning). In the live page: `useKeepAwake(!!matchState.match && matchState.match.status !== "completed")`; after each successful `executeCommand` call `platform.haptics[hapticFor(matchState, newMatchState) === "success" ? "success" : "tap"]()` without awaiting. `LandscapeHint` reads `matchMedia("(orientation: portrait)")` and `matchMedia("(pointer: coarse)")` (listening to changes), stores dismissal under `landscapeHintKey`, renders a small dismissible bar above the court with one translated sentence and a close button (`data-testid="landscape-hint"`).
- [ ] **Step 4: Run** `pnpm test` — PASS; `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e --project=live` — PASS (desktop Chrome has a fine pointer, so the hint stays hidden there).
- [ ] **Step 5: Emulator check**: during a live match the screen does not dim after the emulator's screen timeout; the hint shows in portrait, hides on rotation, stays hidden after dismissal when reopening that match.
- [ ] **Step 6: Commit** — `feat(live): keep the screen awake, haptics and a landscape hint`.

### Task 6: Android back button, incoming links, association files

**Files:**
- Modify: `lib/routes.ts`, `app/layout.tsx` (render `<NativeBridge />` inside `LeaveGuardProvider`)
- Create: `lib/native/back-action.ts`, `components/native/native-bridge.tsx`, `lib/server/app-links.ts`, `app/.well-known/apple-app-site-association/route.web.ts`, `app/.well-known/assetlinks.json/route.web.ts`
- Test: `tests/unit/routes/app-links.test.ts`, `tests/unit/native/back-action.test.ts`, `tests/unit/server/app-links.test.ts`

Note: `lib/native/` is a new core-style folder (pure, no React); add it to the core-folder ESLint list.

**Interfaces:**
- Consumes: `platform.onAppUrlOpen`, `platform.onBackButton`, `platform.exitApp`, `platform.webOrigin()` (Task 3); `useConfirmLeave()` from `components/providers/leave-guard-provider.tsx`; `LEGACY_ROUTE_REDIRECTS` in `lib/routes.ts`.
- Produces:
  - `appRouteFromUrl(url: string, webOrigin: string): string` — `/` unless `url` parses and its origin equals `webOrigin`; old path forms (the six of `LEGACY_ROUTE_REDIRECTS`, UUID case-insensitive, lower-cased in the result) become their new route with the original query appended; any other path is returned with its query as is.
  - `backAction(state: { dialogOpen: boolean; guardActive: boolean; canGoBack: boolean; pathname: string }): "close-dialog" | "confirm-leave" | "back" | "home" | "exit"` — in that priority: dialog open → `close-dialog`; guard active → `confirm-leave`; `canGoBack` → `back`; `normalizePath(pathname) === "/"` → `exit`; else `home`.
  - `appleAppSiteAssociation(env: { APPLE_TEAM_ID?: string; IOS_BUNDLE_ID?: string }): object | null` → `{ applinks: { details: [{ appIDs: ["<team>.<bundle>"], components: [{ "/": "/auth/*" }, { "/": "/matches/*" }] }] } }`, or `null` if either value is missing.
  - `assetLinks(env: { ANDROID_PACKAGE?: string; ANDROID_CERT_SHA256?: string }): object[] | null` → `[{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name, sha256_cert_fingerprints: <comma-split, trimmed, non-empty> } }]`, or `null`.
- The two routes answer `200` JSON (`Content-Type: application/json`) or `404`, no redirect, web target only.

- [ ] **Step 1: Write the failing tests** (Review Focus 2 and 3):

```ts
const web = "https://app.example";
it.each([
  ["https://app.example/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&team=t", "/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&team=t"],
  ["https://app.example/matches/1B9D6BCD-BBFD-4B2D-9B5D-AB8DFBBD4BED/live?team=x", "/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed&team=x"],
  ["https://app.example/teams/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", "/teams/view?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"],
  ["https://app.example/teams/new", "/teams/new"],
  ["https://app.example/auth/confirm?token_hash=abc&type=recovery", "/auth/confirm?token_hash=abc&type=recovery"],
  ["https://evil.example/matches/live?id=1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", "/"],
  ["not a url", "/"],
])("maps %s", (url, route) => expect(appRouteFromUrl(url, web)).toBe(route));

it("closes a dialog before anything else, even on the live page", () =>
  expect(backAction({ dialogOpen: true, guardActive: true, canGoBack: true, pathname: "/matches/live/" })).toBe("close-dialog"));
it("asks before leaving a live match", () =>
  expect(backAction({ dialogOpen: false, guardActive: true, canGoBack: true, pathname: "/matches/live/" })).toBe("confirm-leave"));
it("exits from the home page and goes home elsewhere", () => {
  expect(backAction({ dialogOpen: false, guardActive: false, canGoBack: false, pathname: "/" })).toBe("exit");
  expect(backAction({ dialogOpen: false, guardActive: false, canGoBack: false, pathname: "/teams/" })).toBe("home");
});
// app-links: both builders return null with a missing value; fingerprints "A, B,," → ["A","B"].
```

- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Implement** the helpers and routes. `NativeBridge` (client, renders nothing): on `onAppUrlOpen` → `router.push(appRouteFromUrl(url, platform.webOrigin()))`; on `onBackButton(canGoBack)` → compute `dialogOpen` as `!!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')`, `guardActive` from `useConfirmLeave().isActive()`, then: `close-dialog` → dispatch a `keydown` `Escape` event on `document.activeElement ?? document.body` (bubbling); `confirm-leave` → `await confirmLeave()` and `router.back()` only on `"leave"`; `back` → `router.back()`; `home` → `router.replace("/")`; `exit` → `platform.exitApp()`.
- [ ] **Step 4: Run** `pnpm test` — PASS. `pnpm build`, start on 3100 with `APPLE_TEAM_ID=TEAMID IOS_BUNDLE_ID=com.volleystats.app ANDROID_PACKAGE=com.volleystats.app ANDROID_CERT_SHA256=AA:BB` and check `curl -i http://localhost:3100/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` → 200 JSON; restart without them → 404. If Next 16 does not route `app/.well-known/…`, move the handlers to `app/api/well-known/{apple,android}/route.web.ts` and add web-only `rewrites()` from the two public paths (record it in the commit message).
- [ ] **Step 5: Emulator check** of the back button: a dialog open on the live page closes; on the live page without a dialog the leave dialog appears; from the landing page the app closes. Incoming links cannot reach the app before part B (no intent filter without a domain); the unit tests cover the mapping.
- [ ] **Step 6: Commit** — `feat(mobile): Android back button, incoming links, association files`.

### Task 7: Migration — admin role and app config

**Files:**
- Create: `supabase/migrations/20261023000000_app_role_and_config.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated), `lib/types.ts` (`Profile.role?: "user" | "admin"` — optional, since profiles cached on a device before the migration have none; absent means not admin)

**Interfaces:**
- Produces: `profiles.role` (`'user' | 'admin'`, default `'user'`); table `public.app_config(platform text pk in ('ios','android'), min_version text, latest_version text, store_url text null, updated_at timestamptz)` readable by `anon` and `authenticated`, rows `ios` and `android` at `0.0.0`.

- [ ] **Step 1: Give the user the read-only checks** and wait for the pasted results:

```sql
-- 1. Account deletion migration applied (open item from sub-project 1)
select proname from pg_proc where proname = 'delete_my_account';
-- 2. Current profiles policies and triggers (not in supabase/migrations)
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'profiles';
select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal;
-- 3. Column grants on profiles for the API roles
select grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = 'profiles' and grantee in ('anon','authenticated');
```

Adjust the migration if a policy or trigger conflicts (for example an existing `before update` trigger), and tell the user.
- [ ] **Step 2: Write the migration** (header comment: "Backward compatible: adds a defaulted column and a new table; older apps never write `role`."):

```sql
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.protect_profile_role() returns trigger
language plpgsql set search_path = '' as $$
declare caller_role text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  -- Requests from the app (anon/authenticated) may not set or change the role; SQL in the dashboard,
  -- the service role and the sign-up trigger (no JWT claims) may.
  if caller_role in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.role <> 'user' then
      raise exception 'role_not_allowed' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'role_not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

create table if not exists public.app_config (
  platform text primary key check (platform in ('ios', 'android')),
  min_version text not null default '0.0.0' check (min_version ~ '^\d+(\.\d+)*$'),
  latest_version text not null default '0.0.0' check (latest_version ~ '^\d+(\.\d+)*$'),
  store_url text,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
drop policy if exists "app_config readable by everyone" on public.app_config;
create policy "app_config readable by everyone" on public.app_config for select to anon, authenticated using (true);
grant select on public.app_config to anon, authenticated;
insert into public.app_config (platform) values ('ios'), ('android') on conflict (platform) do nothing;
```

- [ ] **Step 3: Give the user** the migration to run, then the verification SQL (Review Focus 4), and wait for the results:

Run each block separately (the second one ends in an error by design):

```sql
-- A. A user can still edit their profile. Expected: UPDATE 1, then ROLLBACK.
begin;
select set_config('test.uid', (select id::text from public.profiles limit 1), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.uid'))::text, true);
set local role authenticated;
update public.profiles set first_name = first_name where id = current_setting('test.uid')::uuid;
rollback;

-- B. A user cannot make themselves admin. Expected: ERROR role_not_allowed.
begin;
select set_config('test.uid', (select id::text from public.profiles limit 1), true);
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', current_setting('test.uid'))::text, true);
set local role authenticated;
update public.profiles set role = 'admin' where id = current_setting('test.uid')::uuid;
rollback;

-- C. Config rows. Expected: android and ios at 0.0.0.
select platform, min_version, latest_version from public.app_config order by platform;
```

Then ask the user to run `update public.profiles set role = 'admin' where id = '<their user id>';`.
- [ ] **Step 4: Regenerate types** — `pnpm supabase:types`; update `Profile` in `lib/types.ts`; `npx tsc --noEmit` — no new errors.
- [ ] **Step 5: Run** `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/05-settings.spec.ts` — PASS (profile edits still save).
- [ ] **Step 6: Commit** — `feat(db): profiles.role with a protecting trigger, app_config table`.

### Task 8: Minimum-version check and app version stamping

**Files:**
- Create: `lib/utils/version.ts`, `lib/api/app-config.ts`, `components/native/update-gate.tsx`, `scripts/sync-app-version.mjs`
- Modify: `app/layout.tsx` (render `<UpdateGate />` inside `AuthProvider`), `scripts/cap-sync.mjs` (run `sync-app-version.mjs` before `cap sync`), `messages/*/common.json`
- Test: `tests/unit/utils/version.test.ts`, `tests/unit/build/sync-app-version.test.ts`

**Interfaces:**
- Consumes: `platform.appVersion()`, `platform.nativePlatform`, `platform.onForeground()` (Task 3); `app_config` (Task 7).
- Produces:
  - `compareVersions(a: string, b: string): -1 | 0 | 1 | null` — dotted numbers, missing parts are 0 (`1.4` = `1.4.0`), `null` if either is not `^\d+(\.\d+)*$`.
  - `updateStatus(current: string | null, config: { min_version: string; latest_version: string } | null): "ok" | "available" | "required"` — `"ok"` when `current` or `config` is null or any comparison is `null`.
  - `updateUi(status, { onLivePage, bannerDismissed }: { onLivePage: boolean; bannerDismissed: boolean }): "none" | "banner" | "block"` — `required` → `block` unless `onLivePage` (then `none`); `available` → `banner` unless dismissed; `ok` → `none`.
  - `getAppConfig(supabase, platform: "ios" | "android"): Promise<{ min_version; latest_version; store_url } | null>` — `null` on error or missing row.
  - `versionCode(version: string): number` = `major * 10000 + minor * 100 + patch` (in `scripts/sync-app-version.mjs`, exported for the test); the script writes `package.json` `version` into `android/app/build.gradle` (`versionName`, `versionCode`) and `ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` = `versionCode`).

- [ ] **Step 1: Write the failing tests** (Review Focus 1):

```ts
it.each([["1.4.10","1.4.9",1],["1.4","1.4.0",0],["1.0.0","2.0.0",-1],["1.0.0-beta","1.0.0",null],["","1.0.0",null]])
  ("compareVersions(%s, %s)", (a, b, r) => expect(compareVersions(a, b)).toBe(r));
it("never blocks without data", () => {
  expect(updateStatus(null, { min_version: "9.0.0", latest_version: "9.0.0" })).toBe("ok");
  expect(updateStatus("1.0.0", null)).toBe("ok");
  expect(updateStatus("1.0.0", { min_version: "x", latest_version: "1.0.0" })).toBe("ok");
});
it("asks for an update below min, offers one below latest", () => {
  expect(updateStatus("1.0.0", { min_version: "1.1.0", latest_version: "1.2.0" })).toBe("required");
  expect(updateStatus("1.1.0", { min_version: "1.1.0", latest_version: "1.2.0" })).toBe("available");
});
it("waits for the live page to be left before blocking", () => {
  expect(updateUi("required", { onLivePage: true, bannerDismissed: false })).toBe("none");
  expect(updateUi("required", { onLivePage: false, bannerDismissed: true })).toBe("block");
  expect(updateUi("available", { onLivePage: false, bannerDismissed: true })).toBe("none");
});
it("computes the Android version code", () => expect(versionCode("1.4.10")).toBe(10410));
```

- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Implement.** `UpdateGate` (client): returns null unless `platform.nativePlatform`; on mount and on `onForeground`, when `navigator.onLine`, fetches `getAppConfig` and `appVersion()`, computes `updateStatus`; renders per `updateUi` with `onLivePage = normalizePath(pathname) === "/matches/live"` and a session-only dismissed flag: the banner (dismissible, `data-testid="update-banner"`) or a full-screen page (`data-testid="update-required"`, title, one sentence, a "Update" button opening `store_url` with `window.open(url, "_system")`, hidden while `store_url` is null). New strings in the five locales.
- [ ] **Step 4: Run** `pnpm test` — PASS; `pnpm cap:sync` stamps `0.1.0` / `100` into both native projects (check `git diff android/app/build.gradle`).
- [ ] **Step 5: Emulator check**: user sets `update public.app_config set latest_version = '0.2.0' where platform = 'android';` → banner on next foreground; `min_version = '0.2.0'` → block page, but not while a live match is on screen (appears after leaving it); reset both to `0.0.0`.
- [ ] **Step 6: Commit** — `feat(mobile): minimum app version check`.

### Task 9: Admin-only FFVB import

**Files:**
- Create: `lib/server/admin.ts`, `components/championships/ffvb-import-button.tsx`
- Modify: `app/api/import/ffvb/route.web.ts` (also drop the unused `import { create } from "lodash"`), `app/championships/view/page.tsx:237-250`, `messages/*/championships.json` (or the namespace holding `import.comingSoon`)
- Test: `tests/unit/server/admin.test.ts`, `tests/e2e/18-ffvb-admin.spec.ts`

**Interfaces:**
- Consumes: `getReportCaller(request)` (`lib/server/report-caller.ts`), `Profile.role` (Task 7), `apiFetch` (`lib/api-client.ts`), `platform.target`, `useAuth()`.
- Produces: `requireAdmin(request: Request): Promise<{ caller: ReportCaller } | { status: 401 | 403 }>` — 401 without a caller; reads `profiles.role` for `caller.userId` with `caller.supabase`; 403 unless `"admin"` (also 403 if the read fails). `isAdmin(user: User | null): boolean` (client, in the button file) = `user?.profile.role === "admin"`.

- [ ] **Step 1: Write the failing tests**: `requireAdmin` with `getReportCaller` mocked: null → `{ status: 401 }`; caller whose profile query returns `{ role: "user" }` → 403; query error → 403; `{ role: "admin" }` → `{ caller }`. E2E `18-ffvb-admin.spec.ts` (tag `@web`, project `core`): the e2e user (not admin) opens a championship view → `getByTestId("ffvb-import-button")` has count 0; `page.request.post("/api/import/ffvb", { data: { seasonId: "x", championshipId: "y" } })` → status 403.
- [ ] **Step 2: Run** the unit test — FAIL.
- [ ] **Step 3: Implement.** Route: `const access = await requireAdmin(request); if ("status" in access) return NextResponse.json({ error: access.status === 401 ? "unauthorized" : "forbidden" }, { status: access.status });` before parsing the body; the import keeps the service-role client. Button: rendered only when `platform.target === "web" && isAdmin(user)`; enabled; on click `apiFetch("/api/import/ffvb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasonId, championshipId }) })`, spinner while running, success / failure toast (new strings, five locales; the failure toast shows the server's `error` text). Remove the disabled placeholder and its comment.
- [ ] **Step 4: Run** `pnpm test` — PASS; `pnpm build`, restart 3100, `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/18-ffvb-admin.spec.ts tests/e2e/03-championships.spec.ts` — PASS.
- [ ] **Step 5: Ask the user** to sign in as admin on the local web server and run one import on a championship of their choice (it writes real data); report the result.
- [ ] **Step 6: Commit** — `feat(ffvb): import restricted to application admins, web only`.

### Task 10: Analytics web-only, old auth callback removed

**Files:**
- Create: `components/analytics.tsx`
- Modify: `app/layout.tsx:116`, `.claude/docs/02-architecture.md`, `.claude/docs/06-auth.md`
- Delete: `app/auth/callback/route.web.ts`

**Interfaces:**
- Produces: `<Analytics />` (client) renders `<GoogleAnalytics gaId=… />` only when `platform.target === "web"`, `process.env.NODE_ENV !== "development"` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set (the current condition).

- [ ] **Step 1: Precondition**: ask the user whether the `send-email` function has been deployed with `token_hash` links (open item); if not, do the analytics part only and leave the callback deletion as an unchecked step for Task 13.
- [ ] **Step 2: Implement** `Analytics` and use it in the layout; delete the callback route; remove its mentions from the two docs (the `send-email` comment and test about `/auth/callback` redirects stay: they still filter old `redirect_to` values).
- [ ] **Step 3: Verify**: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST pnpm build:mobile` then `grep -rl "googletagmanager" out/` → no match; `pnpm build` and `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/auth/callback?code=x` → 404; `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/11-auth-confirm.spec.ts` — PASS.
- [ ] **Step 4: Commit** — `chore: no analytics in the app, remove the old PKCE callback`.

### Task 11: Privacy policy and iOS privacy manifest

**Files:**
- Create: `app/privacy/page.tsx`, `messages/{en,fr,es,it,pt}/privacy.json` (register the namespace where the other namespaces are loaded), `ios/App/App/PrivacyInfo.xcprivacy`
- Modify: `lib/routes.ts` (`routes.privacy()`, `isPublicPath` includes `/privacy`), `scripts/lib/export-check.mjs` (`EXPECTED_PAGES` gains `/privacy`), `app/settings/page.tsx`, `app/auth/page.tsx` (link), `ios/App/App.xcodeproj/project.pbxproj`, `tests/e2e/00-public-access.spec.ts`, `tests/unit/routes/routes.test.ts`

**Interfaces:**
- Produces: public page `/privacy` (`data-testid="privacy-policy"`).

- [ ] **Step 1: Write the failing tests**: `isPublicPath("/privacy")` and `isPublicPath("/privacy/")` → true (unit); in `00-public-access`, a signed-out visitor opens `/privacy` and sees `privacy-policy`.
- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Write the page** from §8: sections for data collected (email, first and last name, language, favourites, teams, players and match statistics users enter, a per-install device id and device label used to know which device is scoring), purpose (running the app only), no advertising, no selling, no analytics in the mobile app, processor (Supabase, hosting region as configured), retention and account deletion in settings, rights and contact. Publisher name and contact email are the visible placeholders `[Publisher name]` and `[contact@example.com]` (filled in part B). English text first, then the four translations. Links from settings (near the delete-account card) and the sign-in page footer.
- [ ] **Step 4: Write `PrivacyInfo.xcprivacy`**: `NSPrivacyTracking` false; `NSPrivacyTrackingDomains` empty; `NSPrivacyCollectedDataTypes`: `NSPrivacyCollectedDataTypeEmailAddress`, `…Name`, `…OtherUserContent`, `…DeviceID`, each `Linked` true, `Tracking` false, purpose `NSPrivacyCollectedDataTypePurposeAppFunctionality`; `NSPrivacyAccessedAPITypes`: `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1`. Register the file in `project.pbxproj` (a `PBXFileReference`, a `PBXBuildFile`, the App group, the App target's Resources build phase) with new unique 24-hex ids. Task 12's iOS job checks that it lands in the built `.app`.
- [ ] **Step 5: Run** `pnpm test`, `pnpm i18n:check`, `pnpm build:mobile && pnpm check:export`, the `00-public-access` e2e on web — PASS.
- [ ] **Step 6: Commit** — `feat: privacy policy page and iOS privacy manifest`.

### Task 12: CI — Android and iOS builds

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `checks` job's `out/` (upload it with `actions/upload-artifact` after "Export check").
- Produces: job `android` (ubuntu-latest, needs `checks`): download `out/`, Node 24 + pnpm install, `actions/setup-java` Temurin 21, `npx cap sync android`, `./gradlew assembleDebug` in `android/`, upload `android/app/build/outputs/apk/debug/*.apk` as artifact `volleystats-debug-apk`. Job `ios` (a GitHub-hosted macOS image with Xcode 26 — check the current label in GitHub's runner-images list, e.g. `macos-26`; needs `checks`): download `out/`, install, `npx cap sync ios`, `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build -derivedDataPath build`, then fail unless `find build -name PrivacyInfo.xcprivacy -path '*App.app*'` finds the manifest. Add `workflow_dispatch:` to the triggers.

- [ ] **Step 1: If `ios/` is not committed yet** (Task 1 Step 3 fell back), add a temporary `workflow_dispatch` job that runs `npx cap add ios` on macOS and uploads `ios/` as an artifact; after the user pushes and runs it, download the artifact, commit `ios/`, then redo Task 11 Step 4 and remove the temporary job.
- [ ] **Step 2: Write the jobs.**
- [ ] **Step 3: Validate locally** what can be: `cd android && ./gradlew assembleDebug` (with `JAVA_HOME` on JDK 21) — BUILD SUCCESSFUL; YAML parses (`npx --yes yaml-lint .github/workflows/ci.yml` or `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"`).
- [ ] **Step 4: Ask the user** to confirm the four repository variables are set (open item) and whether to push the branch; on yes, `git push -u origin feature/capacitor-app` and `gh workflow run ci.yml --ref feature/capacitor-app`, then `gh run watch`. Expected: `checks`, `android`, `ios` all green. Fix and repeat on failure.
- [ ] **Step 5: Commit** — `ci: Android debug build and unsigned iOS simulator build`.

### Task 14: Bottom tab bar in the installed app (run before Task 13)

Added after the plan was approved (spec §4 "Bottom tab bar"). Run it after Task 12 and before Task 13.

**Files:**
- Create: `lib/native/tab-bar.ts`, `components/navigation/nav-items.ts`, `components/navigation/bottom-tab-bar.tsx`
- Modify: `components/navigation.tsx` (use the shared items; in the app render no hamburger and no header links), `app/layout.tsx` (render `<BottomTabBar />` after `<main>`, pad the content when it shows)
- Test: `tests/unit/native/tab-bar.test.ts`

**Interfaces:**
- Consumes: `platform.nativePlatform` (Task 3), `useKeyboard().visible` (`contexts/keyboard-context.tsx`), `normalizePath` (`lib/routes.ts`), `GuardedLink` as used in `components/navigation.tsx`, the `navigation.menu.*` labels.
- Produces:
  - `NAV_SECTIONS = ["/championships", "/matches", "/teams", "/settings"] as const` in `lib/native/tab-bar.ts`.
  - `activeSection(pathname: string): (typeof NAV_SECTIONS)[number] | null` — the section whose path equals `normalizePath(pathname)` or prefixes it followed by `/` (`/teams/view` → `/teams`, `/matches/stats` → `/matches`); `null` for `/`, `/auth…`, `/privacy`.
  - `showTabBar({ nativeApp, pathname, keyboardOpen }: { nativeApp: boolean; pathname: string; keyboardOpen: boolean }): boolean` — `nativeApp && !keyboardOpen && normalizePath(pathname) !== "/matches/live"` and not on `/auth` pages (signed-out screens keep no tab bar).
  - `navItems(t)` in `components/navigation/nav-items.ts`: the four `{ href, label, icon }` entries now inlined in `navigation.tsx` (Trophy, Volleyball, Users, Settings), shared by the header and the tab bar.

- [ ] **Step 1: Write the failing tests**: `activeSection` — `/teams/view/` → `/teams`, `/matches/stats` → `/matches`, `/matches/live` → `/matches`, `/championships/view` → `/championships`, `/settings/` → `/settings`, `/` → null, `/teamsx` → null; `showTabBar` — false when not native, false with the keyboard open, false on `/matches/live/`, false on `/auth` and `/auth/confirm`, true on `/teams/view` in the app.
- [ ] **Step 2: Run** them — FAIL.
- [ ] **Step 3: Implement.** `BottomTabBar` (client): renders only when `showTabBar(...)` with `nativeApp = platform.nativePlatform !== null` and a signed-in user; fixed to the bottom, full width, four equal `GuardedLink` tabs (icon above a short label, `aria-current="page"` on the active one, `data-testid="bottom-tab-bar"`), `padding-bottom: env(safe-area-inset-bottom)`, theme colours like the header. The layout adds bottom padding to `<main>` equal to the bar height plus the safe-area inset only while the bar shows (expose the visibility through a small hook `useTabBarVisible()` in `bottom-tab-bar.tsx` so both use the same rule). In `navigation.tsx`, when `platform.nativePlatform !== null`, skip the hamburger `Sheet` and the `md:flex` header links; the landscape live-page header stays as it is.
- [ ] **Step 4: Run** `pnpm test` — PASS; web e2e `pnpm test:e2e:quick` — PASS (web unchanged); export e2e (Task 3 Step 6 command) — PASS (browser export unchanged).
- [ ] **Step 5: Emulator check**, phone (Pixel_9_Pro_XL) and a tablet AVD if one exists (create a Pixel Tablet AVD with the installed android-36 image if not): tab bar visible on matches/teams/championships/settings with the right active tab; hidden on the live match page and while typing in a form; content not hidden behind it; above the gesture bar in portrait and landscape; the header shows no hamburger.
- [ ] **Step 6: Commit** — `feat(mobile): bottom tab bar in the installed app`.

### Task 13: Policy, checklists, docs, final verification

**Files:**
- Create: `.claude/docs/11-mobile-app.md`, `docs/superpowers/notes/2026-10-22-android-manual-checklist.md`, `docs/superpowers/notes/2026-10-22-store-release-checklist.md`
- Modify: `CLAUDE.md`, `.claude/docs/README.md`, `.claude/docs/02-architecture.md` (Capacitor, `lib/platform` members, `.well-known`, env vars `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `ANDROID_PACKAGE`, `ANDROID_CERT_SHA256`, `CAP_DEV_HTTP`), `.claude/docs/05-database-schema.md` (`profiles.role`, `app_config`), `.claude/docs/capacitor-integration.md` (replace with a pointer to `11-mobile-app.md`)

- [ ] **Step 1: Write `11-mobile-app.md`**: how to build and run the Android app (commands, emulator build values, JDK), how CI builds iOS, the native features and where they live, and the compatibility policy of §5 verbatim (rules 1–4) with the migration header question; add the "migration header" rule to `CLAUDE.md` and a line pointing at the doc.
- [ ] **Step 2: Write the Android manual checklist**: the "Done when" 1 items of the spec, plus the bottom tab bar (Task 14), keep-awake, rotation during a live match, update banner/block (Task 8 Step 5), back button cases (Review Focus 3), share sheet with the PDF.
- [ ] **Step 3: Write the store release checklist** from §11, with exact files and commands, including the drafted store answers of §8 (Apple privacy labels matching `PrivacyInfo.xcprivacy`, the Google Play data safety form, the account-deletion URL `<web origin>/settings`, age rating notes); in step 2 of it, list every "For Dummies" occurrence found by `grep -rn "For Dummies\|for Dummies\|FOR DUMMIES" app components messages public supabase` (file:line), plus `public/logo.png`.
- [ ] **Step 4: Full verification**: `pnpm test`; lint gate; `npx tsc --noEmit`; `pnpm i18n:check`; `pnpm build` + full web e2e `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`; the export suite (Task 3 Step 6 command); the Android manual checklist on the emulator, every item ticked with notes. Stop every server by PID.
- [ ] **Step 5: Remind the user** of their open actions: `API_CORS_ORIGINS` on the deployed web app gains `capacitor://localhost,https://localhost`; the GitHub variables; `send-email` deploy (and Task 10's callback deletion if it was deferred); their admin role SQL.
- [ ] **Step 6: Commit** — `docs: mobile app guide, compatibility policy and release checklists`.
