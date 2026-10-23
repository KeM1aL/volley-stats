# Capacitor routing check (plan task 1)

**Capacitor:** `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/cli` 8.5.3.
**Where checked:** Android emulator `Pixel_9_Pro_XL` (Android 16, WebView Chrome 140), debug build of the static export
(`BUILD_TARGET=mobile`, `NEXT_PUBLIC_API_ORIGIN` and `NEXT_PUBLIC_WEB_ORIGIN` = `http://10.0.2.2:3100`, `CAP_DEV_HTTP=1`),
driven through the WebView DevTools protocol. The app origin is `https://localhost`.
iOS was not run (no Mac); the iOS conclusions come from reading Capacitor's Swift sources.

## Basic run

- The app opens on the landing page. Sign-in with the e2e test user works (header shows "Sign Out").
- `/teams` lists the test user's teams. `/matches` loads (the test user has no matches: "No matches found").

## Result: the spec's worry is confirmed

Capacitor's local server answers **every path without a file extension with the root `index.html`** (Android:
`WebViewLocalServer`, `html5mode` defaults to true; iOS: `CapacitorRouter.route(for:)` returns `/index.html` when the path
has no extension). Observed in the WebView, signed in:

| Action | URL after | What rendered |
|---|---|---|
| `location.assign('/auth/?account-deleted=1')` | `https://localhost/auth/?account-deleted=1` | **Landing page** ("Volleyball Statistics for Dummies", Get Started), not the sign-in form |
| `location.assign('/auth?account-deleted=1')` | `https://localhost/auth?account-deleted=1` | Landing page |
| `location.assign('/matches/')` | `https://localhost/matches/` | Landing page |
| `location.assign('/matches/live/?id=x')` | `https://localhost/matches/live/?id=x` | Landing page |
| Client-side `window.next.router.push('/teams')` | `https://localhost/teams/` | Teams page (correct) |
| `location.reload()` while on `/teams/` (reached client-side) | `https://localhost/teams/` | **Landing page** (the URL stays, the root HTML is hydrated, the router does not correct it) |
| `location.reload()` while on `/matches/` | `https://localhost/matches/` | Landing page |

So client-side navigation works, but any full page load on a sub-path (hard navigation, reload, a link loaded as a page)
shows the landing page.

## Option (b) does not exist in a usable form

- Android: `server.html5mode` (read in `CapConfig`, not in the typed `CapacitorConfig`) only switches the fallback off. With
  `false`, a path without an extension is not answered by the local server at all (`handleLocalRequest` returns `null`),
  so the WebView does not get `<path>/index.html` either. Nothing maps `/teams/` to `teams/index.html`. `RouteProcessor`
  only rewrites the root `index.html` location.
- iOS: no config at all; the router is a Swift protocol (`Router`), replaceable only in native code.

## Chosen fix: option (a) of design section 1

On mobile, never rely on a full page load of a sub-path (Task 2):
- replace `window.location.assign('/auth?account-deleted=1')` (`components/settings/delete-account-card.tsx`) and similar hard
  navigations to sub-paths with router navigation, or navigate to `/` carrying the target, forwarded by a small handler on
  the root page with `router.replace`;
- a reload on a sub-page lands on the landing page; the root handler (or the landing page, when the session exists) has to
  send the user somewhere sensible. Navigations that already target the root (`/`, `/?remove-database=...`) are fine.

## Windows / Git Bash notes (Android build)

- Needs JDK 21 (Gradle 8.14.3 in the wrapper fails on JDK 25 with "Unsupported class file major version 69"):
  `JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"`, `ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"`.
- Capacitor runs `gradlew` through `cmd.exe`; Git Bash exports `NoDefaultCurrentDirectoryInExePath=1`, which makes it fail
  with "'gradlew' n'est pas reconnu". Run `unset NoDefaultCurrentDirectoryInExePath` first.
- `cap run` copies the web assets and rewrites `capacitor.config.json` again, so `CAP_DEV_HTTP=1` must be set on the
  `pnpm cap:android` command too, not only on `pnpm cap:sync`, or the cleartext settings are lost.
- `pnpm cap:android` can keep running after the app has started (the first build took more than ten minutes while Gradle
  downloaded dependencies); check `adb shell pm list packages | grep volleystats`.
- `adb forward tcp:9222 ...` fails with error 10013 on this PC (port in a Windows excluded range): use another port, e.g. 19222.
- `pnpm build` (web) and `pnpm build:mobile` both write `.next/`: do not run a mobile build while `pnpm start` is serving.
- `ios/` was generated on Windows by `npx cap add ios` (Swift Package Manager, `ios/App/CapApp-SPM`); no macOS runner was needed for it.
