# Store release checklist (part B)

Executed once the Apple and Google accounts, the production domain and the store name exist. Written at the end of part A from the spec (`docs/superpowers/specs/2026-10-22-capacitor-app-design.md`, section 11); the app guide is `.claude/docs/11-mobile-app.md`. The compatibility policy applies from the first store release on. Never write a secret into the repository: signing material goes into GitHub secrets or stays on the developer's PC.

## Open items carried over from part A

- [x] (done 2026-10-23) Run `supabase/migrations/20261023000100_protect_profile_role_empty_claims.sql` in the Supabase dashboard (`20261023000000_app_role_and_config.sql` is already applied, and the account is already an admin).
- [ ] Real FFVB import as an admin on the web app (Task 9 Step 5): the "Import" button on a championship page runs the import and shows the result toast; not done yet (the 401 / 403 / 200 cases are covered by unit and e2e tests only).
- [x] (done 2026-10-23) `send-email` deployed with `/auth/confirm` links; `app/auth/callback/route.web.ts` deleted (the `send-email` comment and test about old `/auth/callback` redirects stay: they filter old `redirect_to` values).
- [ ] Add `capacitor://localhost,https://localhost` to `API_CORS_ORIGINS` on the deployed web app (Android's origin is `https://localhost`, iOS's is `capacitor://localhost`).
- [x] (done 2026-10-23) Set the four GitHub Actions repository variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_WEB_ORIGIN`); CI fails without them.
- [x] (checked 2026-10-22: `delete_my_account` exists) Check that `20261015000000_account_deletion.sql` is applied (account deletion must work before the stores review it).
- [ ] Real dashboard check of the update screen on a device (last open item of the Android manual checklist).
- [ ] Run the haptics check on an Android phone (no vibration on the emulator).
- [ ] Decide `loggingBehavior` in `capacitor.config.ts` (see step 4): the shipped file sets nothing.
- [ ] Decide `android:allowBackup` and the backup rules in `AndroidManifest.xml` (Android backups include the Preferences session token and the IndexedDB match data; exclude them with `android:allowBackup="false"` or `dataExtractionRules` / `fullBackupContent` if that is not wanted).
- [ ] Test the update page's store button in the app once `store_url` exists (`window.open(url, '_system')` must open the Play Store / App Store, not an in-app view).

## 1. Accounts

- [ ] Apple Developer Program (about 99 USD a year), as an individual or an organisation (an organisation needs a D-U-N-S number).
- [ ] Google Play Console (25 USD once). New personal accounts must run a closed test (a number of testers over a number of days) before production access: start it early.
- Recommendation from the design: pay the Apple fee as soon as the Android app works, to leave one to two weeks of iPad testing before submission. The app has never run on iOS (CI compile only).

## 2. Store name, application id, icon, and the "For Dummies" wording

Choose the store name (it must not contain "For Dummies": Wiley trademark, stores reject it), the bundle id / application id (permanent at the first upload; the working id is `com.volleystats.app`) and confirm the icon (`assets/`, built by `pnpm app:assets`).

Change the id and name in:
- [ ] `capacitor.config.ts`: `appId`, `appName`.
- [ ] Android: `android/app/build.gradle` (`namespace`, `applicationId`), `android/app/src/main/res/values/strings.xml` (`app_name`, `title_activity_main`, `package_name`, `custom_url_scheme`), the folder `android/app/src/main/java/com/volleystats/app/MainActivity.java` (package line and folders) if the package changes.
- [ ] iOS: `PRODUCT_BUNDLE_IDENTIFIER` in `ios/App/App.xcodeproj/project.pbxproj`, `CFBundleDisplayName` in `ios/App/App/Info.plist`.
- [ ] Then `pnpm cap:sync` and rebuild both native projects; add the new id to `IOS_BUNDLE_ID` and `ANDROID_PACKAGE` (step 6).

Replace the "For Dummies" wording everywhere before any TestFlight build. Occurrences found by `grep -rn "For Dummies\|for Dummies\|FOR DUMMIES" app components messages public supabase` (English only):
- [ ] `app/layout.tsx:34` `APP_TITLE_LONG = 'VolleyStats for Dummies'` (used for the page title, Open Graph site name and title)
- [ ] `app/manifest.webmanifest:2` `"name": "VolleyStats for Dummies"`
- [ ] `messages/en/auth.json:2` `"welcome": "Welcome to VolleyStats for Dummies"`
- [ ] `messages/en/common.json:105` `app.title`
- [ ] `messages/en/common.json:106` `app.titleLong`
- [ ] `messages/en/landing.json:3` `hero.title` "Volleyball Statistics for Dummies"
- [ ] `messages/en/navigation.json:4` `common.app.title`

The other four locales carry the same wording translated (the search above does not find them; they must change too, same keys, same line numbers):
- [ ] Spanish "para Principiantes": `messages/es/auth.json:2`, `messages/es/common.json:105` and `:106`, `messages/es/landing.json:3`, `messages/es/navigation.json:4`
- [ ] French "pour Débutants": `messages/fr/auth.json:2`, `messages/fr/common.json:105` and `:106`, `messages/fr/landing.json:3`, `messages/fr/navigation.json:4`
- [ ] Italian "per Principianti": `messages/it/auth.json:2`, `messages/it/common.json:105` and `:106`, `messages/it/landing.json:3`, `messages/it/navigation.json:4`
- [ ] Portuguese "para Iniciantes": `messages/pt/auth.json:2`, `messages/pt/common.json:105` and `:106`, `messages/pt/landing.json:3`, `messages/pt/navigation.json:4`
- [ ] Search again for the translated forms to be sure: `grep -rnE "Principiantes|Débutants|Principianti|Iniciantes" app components messages public supabase`
- [ ] `public/logo.png`: the in-app and web logo has "FOR DUMMIES" in its ring (the app icon and splash do not: they use only the ball, `scripts/make-app-assets.mjs`). Replace it, and the logo's use in the header (`components/navigation.tsx`).
- [ ] The `send-email` templates (`supabase/functions/send-email/_i18n.ts` and `_templates/`): no "For Dummies" found at the time of writing (they say "VolleyStats"); re-check after choosing the name, and update the product name there.
- [ ] Any e2e test that asserts a title text (none found by `grep -rniE "dummies|Principiantes|Débutants|Principianti|Iniciantes" tests`).

## 3. Domain

- [ ] Vercel: add the production domain.
- [ ] `NEXT_PUBLIC_WEB_ORIGIN` and `NEXT_PUBLIC_API_ORIGIN` (build values for the app and the GitHub variables) set to it.
- [ ] Supabase dashboard (Authentication, URL configuration): site URL and redirect URLs for the domain.
- [ ] `API_CORS_ORIGINS` on the web deployment includes `capacitor://localhost,https://localhost`.
- [ ] Rebuild the app (`pnpm cap:sync`) so the bundle carries the new origins.

## 4. Signing and builds

Android (upload keystore, Play App Signing):
- [ ] Create the upload keystore on the PC: `keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` (JDK 21). Keep it outside the repository; back it up.
- [ ] Add a release signing config in `android/app/build.gradle` reading the keystore path and passwords from environment variables or `~/.gradle/gradle.properties`, never from the repository.
- [ ] Build the bundle: `pnpm cap:sync` (with the production origins and without `CAP_DEV_HTTP`), then `cd android && ./gradlew bundleRelease` (output `android/app/build/outputs/bundle/release/app-release.aab`).
- [ ] Play Console: enrol in Play App Signing, upload the first bundle to the internal testing track.
- [ ] Play's current target API level requirement: `android/variables.gradle` has `targetSdkVersion = 36` (Capacitor 8 default); check it against Play's requirement on the day.
- [ ] Plugin logging: `capacitor.config.ts` sets no `loggingBehavior`, so Capacitor's default (`'debug'`: log in debug builds only) applies. Debug builds log every plugin call to logcat, and `Preferences` calls carry the Supabase session token. Set it explicitly: `loggingBehavior: 'none'` (nothing, recommended for the release config) or `'debug'` (debug builds only), and never `'production'`. Do not share a debug logcat in the meantime.
- [ ] Make sure no release build is made with `CAP_DEV_HTTP=1` (cleartext allowed): check `android/app/src/main/assets/capacitor.config.json` has no `cleartext` after `cap sync`.

iOS (from Windows, no Mac):
- [ ] Certificate signing request with `openssl`: `openssl genrsa -out ios.key 2048` then `openssl req -new -key ios.key -out ios.csr -subj "/emailAddress=<email>/CN=<name>/C=<country>"`; upload `ios.csr` in the Apple developer portal (Certificates, Apple Distribution); download the `.cer`, then `openssl x509 -inform DER -in distribution.cer -out distribution.pem` and `openssl pkcs12 -export -inkey ios.key -in distribution.pem -out distribution.p12`.
- [ ] App Store provisioning profile for the bundle id (App Store distribution).
- [ ] App Store Connect API key (`.p8`), key id and issuer id.
- [ ] Store them as GitHub secrets (base64 of the `.p12` and the profile, their passwords, the API key): a signed CI job, separate from the unsigned compile check in `.github/workflows/ci.yml` (`ios` job), that archives the app (`xcodebuild archive` with the profile) and uploads it to TestFlight (App Store Connect API).
- [ ] Install from TestFlight on the iPad and the iPhone.
- [ ] Check `ios/App/App/PrivacyInfo.xcprivacy` is still bundled (the CI job checks it) and that plugin manifests are present.

## 5. Android signing fingerprints

- [ ] Play Console (App signing): copy the SHA-256 fingerprint of the app signing key and of the upload key; both go into `ANDROID_CERT_SHA256` (comma-separated) so `/.well-known/assetlinks.json` lists both.

## 6. Link association

Values on the web server (Vercel environment variables, names only here):
- [ ] `APPLE_TEAM_ID`, `IOS_BUNDLE_ID` (serve `/.well-known/apple-app-site-association`, paths `/auth/*` and `/matches/*`).
- [ ] `ANDROID_PACKAGE`, `ANDROID_CERT_SHA256` (serve `/.well-known/assetlinks.json`).
- [ ] After deploying, both URLs answer 200 with `Content-Type: application/json` and no redirect (each answers 404 while its values are unset).

Native side:
- [ ] iOS: add the Associated Domains capability with `applinks:<web domain>`: create `ios/App/App/App.entitlements` (`com.apple.developer.associated-domains` array) and set `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` in `ios/App/App.xcodeproj/project.pbxproj`; enable the capability on the App ID in the developer portal.
- [ ] Android: in `android/app/src/main/AndroidManifest.xml`, inside the `MainActivity` `<activity>`, add `<intent-filter android:autoVerify="true">` with `action.VIEW`, `category.DEFAULT`, `category.BROWSABLE` and `<data android:scheme="https" android:host="<web domain>" />`.
- [ ] Test: `adb shell am start -a android.intent.action.VIEW -d "https://<web domain>/matches/live?id=<id>"` opens the app, and `adb shell pm get-app-links <package>` shows the host verified. Auth emails then open the app (`/auth/confirm?...` is mapped by `appRouteFromUrl`).

## 7. iPad and iPhone testing round (TestFlight)

The risk items listed in the design ("Where this sub-project stops"), none ever run on iOS:
- [ ] WebView storage: RxDB (IndexedDB) keeps a played match across app restarts and low-storage conditions; the Supabase session survives restarts (Preferences / UserDefaults).
- [ ] Links (after step 6) and the share sheet on iPad (shown centred by the stock plugin; accepted).
- [ ] The keyboard: `useKeyboard()` / `useTextEntryKeyboard` behaviour in iOS WKWebView (the tab bar must hide while a text field has the keyboard; the Android WebView resizes the page, WKWebView does not), text fields near the bottom tab bar.
- [ ] Safe areas: notch, Dynamic Island, home indicator, both orientations, iPad split view and Stage Manager (all four orientations are enabled).
- [ ] Live match offline on the iPad in airplane mode, then synced; keep-awake; the landscape hint; the bottom tab bar on iPad.
- [ ] Back navigation: iOS has no back button; swipe-back and the in-app leave guard.

## 8. Privacy policy, privacy labels, data safety form

- [ ] Read `/privacy` (five locales; `messages/*/privacy.json`) and fill the publisher's name and contact placeholders; publish it at `<web origin>/privacy` (public).
- [ ] The privacy policy URL in both stores is `<web origin>/privacy`.

Drafted answers (verify against the app on the day):

**Apple, App Privacy ("nutrition labels")** (must match `ios/App/App/PrivacyInfo.xcprivacy`):
- Tracking: No. Tracking domains: none.
- Data collected, all linked to the user, none used for tracking, purpose "App Functionality" only:
  - Contact Info: Email Address (`NSPrivacyCollectedDataTypeEmailAddress`)
  - Contact Info: Name (first and last name, `NSPrivacyCollectedDataTypeName`)
  - User Content: Other User Content (clubs, teams, players, matches and statistics entered by users, `NSPrivacyCollectedDataTypeOtherUserContent`)
  - Identifiers: Device ID (the per-install random id and a device label, used to know which device scores a match, `NSPrivacyCollectedDataTypeDeviceID`)
- Not collected: location, contacts, photos, health, financial info, browsing or search history, diagnostics, purchases, advertising data.
- Required-reason APIs declared: `NSPrivacyAccessedAPICategoryUserDefaults`, reason `CA92.1` (Preferences). Plugin-provided manifests are bundled by their packages, not duplicated.
- No analytics in the app. No advertising.
- Sign in with Apple is not required: the app only has email and password sign-in, no third-party login.

**Google Play, Data safety form:**
- Data collected: Personal info (Name, Email address); App activity / User-generated content (the match data and the entered clubs, teams and players); Device or other IDs (the per-install id). Nothing else.
- Purposes: App functionality (and account management for email and name). Not for analytics, advertising or marketing.
- Shared with third parties: none. Supabase acts as a processor on our behalf (not a "share"). Collection is required (not optional) for the app to work.
- Data encrypted in transit: yes (HTTPS). Users can request deletion: yes.
- Account deletion URL: `<web origin>/settings` (the in-app and web "Delete account" card; also the in-app path). Data deletion: deleting the account removes the profile and sign-in; teams, matches and statistics stay with their teams (stated on the privacy page).
- Not a government app, no ads, no financial features, no health features.

**Age rating notes** (Apple's questionnaire, Play's IARC questionnaire): no violence, sexual content, gambling, drugs, horror or profanity; no purchases; no unrestricted web access (the app opens only its own content and the store link). User-entered text (team and player names) is visible only to the members of those teams and clubs; there is no chat, feed or messaging. One thing to answer with care: shared match statistics pages can be opened without signing in through a link. Expected rating: 4+ (Apple) / Everyone (Play).

## 9. Store listings

- [ ] Screenshots: iPad 13" (e.g. 2064 x 2752), iPhone 6.9" (e.g. 1320 x 2868), Android phone and tablet. The landscape live match and the report are the best shots.
- [ ] Description, short description, keywords, in the five locales (en, es, fr, it, pt) as wanted; support URL; marketing URL.
- [ ] A demo account with data for App Review: an account with a team, players and a completed match, credentials in the review notes (not in the repository).
- [ ] Review notes: sign-in is email and password; the live match works offline; account deletion is in Settings.
- [ ] Category: Sports. Content rights and export compliance (HTTPS only: standard encryption exemption).

## 10. `app_config` rows

- [ ] Once published, set the store URLs and versions in the dashboard (`public.app_config`, one row per platform):
  `update public.app_config set store_url = '<Play Store URL>', latest_version = '<version>' where platform = 'android';`
  `update public.app_config set store_url = '<App Store URL>', latest_version = '<version>' where platform = 'ios';`
- [ ] Keep `min_version` at `0.0.0` until an old version must be forced to update (two-release rule of the compatibility policy). The app version is `package.json` `version`; bump it, then `pnpm cap:sync` (minor and patch at most 99) before each store build.

## 11. Submit

- [ ] Submit to App Review and Google Play review; plan one or two review rounds.
- [ ] After approval, release the first version, then check an install from each store signs in, plays a match offline and syncs.
