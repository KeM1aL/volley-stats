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
- Finding (fixed by Task 16): the separate "Share" button on the stats page called `navigator.share`, which is `undefined` in the Android WebView, so it did nothing there. It now goes through `platform.shareLink` (see the next section).

## Share the stats link (Task 16)

- [x] Stats page, "Share" button: the Android chooser opens ("Sharing link", `http://10.0.2.2:3100/matches/stats?id=<match id>`, copy button, Quick Share, Chrome, Drive, Messages, Bluetooth). Run on 2026-10-22 on the emulator (`navigator.share` is `undefined` in the WebView, confirmed). The emulator's IntentResolver showed an "isn't responding" dialog while the chooser loaded (emulator slowness); "Wait" kept it, and back closed the chooser and returned to the app with no error.
- [ ] Phone: pick a target (for example Messages) and check the link arrives.

## App without a top bar (Tasks 15-16)

To run on the final pass; none of these was looked at on the device yet.

- [ ] No header on any page in the app (no logo, language, theme or Sign Out at the top); the content starts under the status bar.
- [ ] Bottom tab bar: the last tab is "Profile" (person icon). It opens the Profile page: name and email card, the sync status with its text, and "Sign Out"; the settings cards follow.
- [ ] Sign out from the Profile page: with nothing unsent it signs out (asks first only when leaving a live match); with unsent changes it shows the sign-out warning.
- [ ] Matches tab shows an amber dot while changes wait to upload (airplane mode, play a point) and loses it once the badge is "saved".
- [ ] Breadcrumb on sub-pages: team page (Teams > team), players (Teams > team > Players, the team crumb links back), new team, championship, match stats (Matches > Home - Away), match score (the match crumb links to the stats), privacy (Profile > Privacy). Each link goes back to the right page; names truncate. No breadcrumb on the four tab roots, the sign-in pages and the live page. Offline, the stats crumb shows the team names.
- [ ] Live match page: back arrow at the top left with the compact sync badge next to it; back asks "Leave the live match?" when work is unsent or unfinished, then goes back (or to Matches when opened with nothing behind it).
- [ ] "All saved" toast appears once after airplane mode is turned off with changes waiting, on any page (no header badge needed).

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

- [x] Four tabs (Championships, Matches, Teams, Settings) at the bottom of the home page and the four sections; the active tab is highlighted (`/teams/view?id=...` highlights Teams); the header has no hamburger or links outside the live page, only logo, sync indicator, language, theme and Sign Out. (Superseded by Task 15: no header in the app, the last tab is Profile; see "App without a top bar".)
- [x] Sits above the gesture bar in portrait and landscape; the update banner sits above the bar.
- [x] Hidden on the live match page. (Hidden on the sign-in pages: covered by the unit tests of `showTabBar`, not looked at on the device.)
- [x] Hidden while the on-screen keyboard is open (settings page, tap in a text field: viewport 997 to 661 px, bar gone; closing the keyboard with back brings it back); also hidden after rotating to landscape with the keyboard open, and back again once it is closed.
- Emulator note: with the default stylus handwriting toolbar (a floating pill, not a keyboard) the page is not resized and the bar stays; `adb shell settings put secure stylus_handwriting_enabled 0` gives the real Gboard for this test.

## Haptics

- [ ] Light tap on a point or stat, success pattern at the end of a set and of the match: not verifiable on the emulator (no vibration motor). To check on a phone. The live page calls `platform.haptics` (`lib/matches/haptics.ts` decides tap or success) and the plugin call completed without error during the run.

## Other observations

- Debug builds log plugin calls: `adb logcat` shows `Capacitor/Plugin: To native ... Preferences` lines (the session token passes through them). See `loggingBehavior` in the store release checklist.
- The stats page loads its data once per match id: a router navigation that only changes `?team=` on the same page does not reload it (reached from the app's own links this does not happen).
