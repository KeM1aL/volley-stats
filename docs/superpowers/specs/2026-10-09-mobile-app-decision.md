# Mobile App — Decision Record

**Date:** 2026-10-09
**Status:** Approved (decisions); sub-project specs follow separately

## Goal

Publish VolleyStats in the App Store and Google Play, so clubs can find and install it
like any app. Store presence is the reason for the app; native look and feel is not a goal.

Constraints: one developer, alongside the web app, first store release within weeks.

## Decisions

| Topic | Decision |
|---|---|
| Framework | **Capacitor**, wrapping the existing Next.js app as a static export bundled in the app. Not Expo. |
| Code sharing | One codebase, two build targets (`web` = today's Vercel deployment, `mobile` = `output: 'export'`). A `lib/platform/` seam with web and Capacitor implementations, chosen at build time. ESLint `no-restricted-imports` keeps the core folders free of React/DOM/Next. No workspace package split for now. |
| Backend for mobile | The Next.js web deployment serves the app: `/api/v1/*` routes (Bearer Supabase JWT, CORS for `capacitor://localhost` and `https://localhost`), the universal link / app link association files, and auth link confirmation. |
| Deep links | Universal Links (iOS) and App Links (Android) on the web domain, claiming `/auth/*` and `/matches/*`. Auth emails use the `token_hash` flow (`/auth/confirm?token_hash=…&type=…`), verified by the app when installed, by a Next.js route handler otherwise. |
| PDF export | Generated on the server with `@react-pdf/renderer` (`/api/v1/matches/{id}/report`), with a redesigned report, for signed-in team members and club owners/admins only. Replaces the client-side jsPDF + html2canvas export. Spec: [2026-10-09-pdf-report-design.md](2026-10-09-pdf-report-design.md). |
| Server routes | Use the caller's session with the anon key so RLS applies; the service role is not used for caller-driven reads. |

## Why Capacitor, not Expo

| | Capacitor | Expo |
|---|---|---|
| UI reuse | ~100% (same React, Tailwind, Radix code) | ~0%: the UI (~20k lines) is rewritten in React Native |
| Offline core | RxDB on Dexie, unchanged (IndexedDB in the app's WebView) | No IndexedDB. RxDB's free SQLite storage is a trial (500 documents, no indexes); production SQLite on Expo needs RxDB Premium (paid) |
| i18n | next-intl kept (client-side locale) | Move to `use-intl` or i18next |
| Effort, one developer | ~2–4 weeks to a first store build | ~3–6 months, then two UIs to maintain |
| Native feel | Good enough for the goal | Best, but not the goal |

Rejected shortcuts:
- **Capacitor loading the live website (`server.url`)**: frequent App Store rejection (guideline 4.2), and no offline cold start (no service worker in a `capacitor://` WKWebView).
- **Expo DOM components**: each runs in its own WebView, so several RxDB instances compete for the sync leader.

## What the static export requires

Next.js 16 `output: 'export'` does not support (checked in `node_modules/next` 16.3.8 docs):
dynamic routes without `generateStaticParams`, route handlers that rely on the request, cookies,
`proxy`, server actions, rewrites/redirects/headers.

| Today | Mobile target |
|---|---|
| `matches/[id]/{live,score,stats}`, `teams/[id]`, `teams/[id]/players`, `championships/[id]` | Query-param routes (`/matches/live?id=…`); the web build redirects the old URLs |
| `proxy.ts` auth redirect + locale | Client-side auth guard; locale from profile / local storage |
| `lib/i18n/actions.ts` server actions, `i18n.ts` cookie config | Client-side calls and `NextIntlClientProvider` with client-loaded messages |
| `app/auth/callback` route (PKCE code exchange) | `token_hash` confirmation (see Deep links) |
| `app/api/import/ffvb` | Stays on the web deployment, called by the app as `/api/v1/…` |
| Serwist service worker | Disabled in the mobile build (files are bundled) |
| `@supabase/ssr` cookie client | `supabase-js` with local storage in the app |
| `jsPDF.save()` download | Server PDF; the app saves it and opens the native share sheet |

Store requirements to add: in-app account deletion (Apple 5.1.1(v), Google Play; the app has none
today), privacy manifest and policy URL, icons and splash. Native features that also help
App Review: keep the screen awake during a live match, haptics, native share sheet.

## Sub-projects

Each gets its own spec, plan and implementation. Order chosen: **3 → 1 → 2**.

| # | Sub-project | Scope | Estimate |
|---|---|---|---|
| 3 | **Server-side PDF report** (first) | `/api/v1/matches/{id}/report` with `@react-pdf/renderer`, redesigned report; cache keyed on the match's last change; guard while the match has unsent changes; remove jsPDF, html2canvas and the tab-switching export | 1.5–3 weeks |
| 1 | **Static-export readiness** | Query-param routes + web redirects; client auth guard; client locale; `token_hash` auth emails; `lib/platform/` seam + ESLint boundaries; `BUILD_TARGET=mobile` export built in CI; in-app account deletion | 1.5–2 weeks |
| 2 | **Capacitor app + mobile API** | `ios/`, `android/`; Capacitor platform implementations; `/api/v1` with Bearer auth and CORS; link association files; native features; minimum app version check; migration compatibility policy; store submission | 1–2 weeks + review |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Old app versions in the field.** Store builds stay installed for weeks; today every deploy updates every user | Migrations, RLS, triggers, RPCs (`claim_match_scorer`, `x-device-id`) or `/api/v1` changes break older apps, including their unsent offline data | Backward-compatible migrations as a rule; versioned `/api/v1`; minimum-version check that asks the user to update; optional live updates (Capgo / Appflow) |
| Route change to query params | Wide mechanical change; broken links or e2e specs | Web redirects for old URLs (shared `/matches/<id>/stats` links keep working); e2e suite run on both targets |
| Two build targets | Web regressions (auth redirect, locale) | CI builds both targets; web e2e unchanged |
| WebView storage | Unsent rows lost if the OS reclaims app storage | Lower risk than the PWA (no Safari 7-day eviction); moving to SQLite would require RxDB Premium |
| Server PDF needs connectivity and uploaded data | Report misses unsent changes; no offline export | Disable / warn while the match has unsent changes (existing sync flags) |
| `app/api/import/ffvb` uses the service-role client without checking the caller | Anyone can trigger an import | Fixed when it moves to `/api/v1` in sub-project 2: require a session and team/club rights |
| Store review | Rejections delay release | Bundled files, offline scoring, native features, account deletion before the first submission; plan 1–2 review rounds |

## Out of scope

Expo or React Native UI; a workspace package split; offline screens other than the live match;
push notifications; RxDB SQLite storage.
