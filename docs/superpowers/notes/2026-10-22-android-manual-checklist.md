# Android manual checklist (sub-project 2, part A)

Run before calling part A done, on the Android emulator (`Pixel_9_Pro_XL`, Android 16, WebView Chrome 140) or on a phone. Build and run commands: `.claude/docs/11-mobile-app.md`.

**Run on 2026-10-22** by the implementer on the emulator, debug build of this branch (package.json version 0.1.0, versionCode 100), web server on `http://10.0.2.2:3100` (`API_CORS_ORIGINS=https://localhost,http://localhost:3200`), e2e test account. The WebView was driven through the DevTools protocol (adb forward 19222) for in-page actions; the Android parts (airplane mode, rotation, back key, share sheet, keyboard) were done on the system. Items not verifiable on an emulator, or that need the project owner, are marked.

## Setup

- [x] Build and install: `NEXT_PUBLIC_API_ORIGIN=http://10.0.2.2:3100 NEXT_PUBLIC_WEB_ORIGIN=http://10.0.2.2:3100 CAP_DEV_HTTP=1 pnpm cap:sync`, then the same variables with `pnpm cap:android`. The app installed and opened on the landing page. `cap:sync` left the tracked native files unchanged (the version stamp already matched).

## Sign-in, team and match screens ("Done when" 1)

- [x] Sign out, then sign in with the e2e test account from the app's sign-in page: lands on the home page with "Sign Out" in the header. The session survived an app restart (home exit and relaunch).
- [x] Teams list shows the account's teams; "View" opens the team page (`/teams/view/?id=...`) with its information and upcoming match.
- [x] Matches list loads (empty list state shown for the account); Championships and Settings tabs open.

## Live match offline, then synced ("Done when" 1)

Format "Test (6x6)" (5 points a set), a fresh team with 8 players and one match created through the API (e2e seed helpers), started from the Matches page start dialog.

- [x] Start the match, set up set 1 (serving team, six court positions), play 2 points online: they reach the server (2 `score_points`, set 1 at 2-0).
- [x] Airplane mode on (`adb shell cmd connectivity airplane-mode enable`): `navigator.onLine` is false, the sync badge goes to "waiting", the status bar shows the airplane icon.
- [x] Offline, play 3 more points (one of them after rotating to landscape): set 1 ends 5-0, "Second Set Setup" appears, the match score shows 1-0 in sets. Nothing was lost on rotation.
- [x] Airplane mode off: the badge returns to "saved" within seconds without reloading; the server has set 1 at 5-0 with status `completed`, 5 `score_points`, and the match at 1-0. (Two points were recorded online, three offline.)

## Report through the share sheet ("Done when" 1)

- [x] Stats page of that match (with the managed team), "Export PDF": the Android chooser opens ("Sharing 1 file", `<team>-vs-Team 1-2026-10-22.pdf`, Quick Share, Print, Drive, Messages, Bluetooth). The request crossed origins (`https://localhost` to `http://10.0.2.2:3100`), so CORS and Bearer auth work. Closing the chooser with back returns to the app.
- Finding (not changed here): the separate "Share" button on the stats page calls `navigator.share`, which is `undefined` in the Android WebView, so it does nothing there (the error is only logged). Pre-existing; it needs a `@capacitor/share` path behind `lib/platform` if the app should share the stats link.

## Android back button ("Done when" 1, Review Focus 3)

- [x] Dialog first: with the menu sheet open (live page, landscape), back closes it and stays on the page.
- [x] Leave guard: on the live page with an unsent or unfinished match, back opens "Leave the live match?"; back again closes that dialog and stays (Stay); back, then "Leave" goes to `/matches/`.
- [x] History: from there back goes to the previous page (`/teams/view/?id=...`), then through Teams, Settings, Teams, Matches, Championships to `/`.
- [x] Home exits: back on `/` leaves the app (the launcher gets focus).
- [ ] First-history-entry live page (opened from a link) goes home on Leave: covered by unit tests (`backAction`), not run on the device (no link association yet).

## Update banner and block ("Done when" 1, Task 8 Step 5)

Verified by intercepting the Supabase `app_config` response in the WebView (the installed version is 0.1.0); the app was sent to the background and relaunched each time (foreground check).

- [x] `latest_version` 9.0.0 (min 0.0.0), with a store URL: the dismissible "A new version of VolleyStats is available." banner with an "Update" button, shown above the bottom tab bar; the X dismisses it.
- [x] `latest_version` equal to the installed version, and config below the installed version: nothing shown.
- [x] `min_version` 9.0.0: the full-screen "Update required" page (`role=alertdialog`) with the "Update" button; with `store_url` null the button is hidden; lifting the config removes the page.
- [x] Never over a live match: with `min_version` 9.0.0 and the app on the live page (also after a foreground return) nothing is shown; leaving the live page shows the block page.
- [ ] Real dashboard check with the user: edit the `app_config` row for `android` in the Supabase dashboard (`update public.app_config set min_version = '9.0.0' where platform = 'android';`) and bring the app to the foreground. Pending (needs the user; the response is only simulated above).

## Landscape hint ("Done when" 1)

- [x] Opening a live match in portrait shows "Turn your device sideways for a better view of the court." with a close button.
- [x] Rotating to landscape removes it (state kept, see below).
- [x] Dismissed, it stays away for that match: leaving the page and opening the match again shows no hint.

## Keep awake

- [x] On the live page the window has `FLAG_KEEP_SCREEN_ON` and a `SCREEN_BRIGHT_WAKE_LOCK` is held for the app (`adb shell dumpsys window`, `dumpsys power`).
- [x] After leaving the live page the wake lock is gone (`Wake Locks: size=0`).

## Rotation during a live match

- [x] Portrait to landscape in the middle of set 1, offline: the score (3-0), the lineup and the stat tracker are kept, the compact landscape header appears (it keeps its menu button, by design), the hint disappears; scoring continues in landscape. Back to portrait (accelerometer restored) afterwards.

## Bottom tab bar (Task 14)

- [x] Four tabs (Championships, Matches, Teams, Settings) at the bottom of the home page and the four sections; the active tab is highlighted (`/teams/view?id=...` highlights Teams); the header has no hamburger or links outside the live page, only logo, sync indicator, language, theme and Sign Out.
- [x] Sits above the gesture bar in portrait and landscape; the update banner sits above the bar.
- [x] Hidden on the live match page. (Hidden on the sign-in pages: covered by the unit tests of `showTabBar`, not looked at on the device.)
- [x] Hidden while the on-screen keyboard is open (settings page, tap in a text field: viewport 997 to 661 px, bar gone; closing the keyboard with back brings it back); also hidden after rotating to landscape with the keyboard open, and back again once it is closed.
- Emulator note: with the default stylus handwriting toolbar (a floating pill, not a keyboard) the page is not resized and the bar stays; `adb shell settings put secure stylus_handwriting_enabled 0` gives the real Gboard for this test.

## Haptics

- [ ] Light tap on a point or stat, success pattern at the end of a set and of the match: not verifiable on the emulator (no vibration motor). To check on a phone. The live page calls `platform.haptics` (`lib/matches/haptics.ts` decides tap or success) and the plugin call completed without error during the run.

## Other observations

- Debug builds log plugin calls: `adb logcat` shows `Capacitor/Plugin: To native ... Preferences` lines (the session token passes through them). See `loggingBehavior` in the store release checklist.
- The stats page loads its data once per match id: a router navigation that only changes `?team=` on the same page does not reload it (reached from the app's own links this does not happen).
