# Leaving the Live Match — Design

**Date:** 2026-10-13
**Branch:** `fix/live-match-usability` (from `main` @ b33c734)

## Goal

Tapping the header navigation during a live match leaves it without warning, and offline (or on a
weak signal) the destination fails to load and Chrome's error page replaces the app: a blank page,
and in the installed PWA a dead end with no Back button. Ask before any in-app action leaves a
match in progress, and show an app page instead of the browser's error page when a screen can't
load offline.

This is item C of four usability issues (A: sidebar caret, done; B: archive players,
[spec](2026-10-13-archive-players-design.md); D: add a late player to a match in progress, approved
in chat).

## What happens today

Reproduced on the production build (Playwright, 768×1024, from a live match):

| Action | Result |
|---|---|
| Online, header **Matches** | Matches page loads. |
| Offline, header **Teams** | `Failed to fetch RSC payload … Falling back to browser navigation`; the service worker has no cached `/teams`; the tab shows `chrome-error://chromewebdata/`. |
| Offline, browser Back | Live page returns (cached), shows "Loading your profile…" for 5–10 s, then the match with its data. |

The user confirmed the blank page only occurs without a connection or with a weak one.

## Decisions

| Topic | Decision |
|---|---|
| What is guarded | In-app actions only: header links (desktop, compact landscape, mobile sheet), the logo, and sign out. |
| Browser/Android Back | Not intercepted. Offline, a failed Back is caught by the fallback page. |
| Online vs offline | Same confirmation either way; no offline-specific wording or disabled links. Offline-capable screens are a later project. |
| Implementation | Own small guard (provider + link wrapper), not `next-navigation-guard` (relies on Next internals). |
| Fallback page | Static `public/offline.html`, not a Next.js route (the root layout is dynamic and boots the whole app). |

## 1. The guard

### Pieces

- `components/providers/leave-guard-provider.tsx`, mounted in `app/layout.tsx` inside
  `SyncStatusProvider`. Holds whether the guard is active and renders the one shared `AlertDialog`.
  - `useLeaveGuard(options: { active: boolean; unsentCount: number })`: the live page turns the guard
    on and passes this match's unsent count (from `useMatchUnsentCount`) for the dialog.
  - `useConfirmLeave(): () => Promise<boolean>`: resolves `true` at once when the guard is off;
    otherwise opens the dialog and resolves with the user's choice.
- `components/guarded-link.tsx`: wraps `next/link`. On a plain left click while the guard is on, it
  calls `preventDefault()`, awaits the confirmation, then `router.push(href)`. Clicks with a modifier
  key or a non-primary button pass through (they open a new tab and don't leave the match).
- `components/navigation.tsx`: every route link in the three layouts and the logo use `GuardedLink`.
  In the mobile sheet the sheet is closed before the dialog opens.
- Sign out (`components/navigation.tsx`): `handleSignOut` first awaits the leave confirmation. If the
  leave dialog was shown and the user confirmed, the existing unsent-changes sign-out warning is
  skipped (the leave dialog already showed the count); otherwise the existing behaviour is unchanged.
  At most one dialog appears.

### When the guard is on

The live page (`app/matches/[id]/live/page.tsx`) passes `active: true` once the match is loaded,
while `match.status !== "completed"`. It stays on during the scorer-claim prompt and the read-only
(taken-over) state: the user is still on the match. It is off while loading, after a load failure,
and on the finished-match view.

Not guarded (deliberate exits): the redirect to `/matches` when the match fails to load, "Cancel" in
the scorer-claim dialog, and the Stats button of a finished match.

### The dialog

- Title: "Leave the live match?"
- Body: "Everything recorded so far is saved on this device. You can come back to this match from
  Matches."
- When `unsentCount > 0`: "{count, plural, one {# change hasn't} other {# changes haven't}} been
  uploaded yet. They'll upload automatically once you're back online."
- Buttons: **Stay** (default focus; Enter and Escape keep the user on the match) and **Leave**.
- `data-testid="leave-live-dialog"`. New `liveGuard.*` keys in en, fr, es, it and pt.

Unchanged: `useBeforeUnloadWhenUnsent` (the browser's own prompt when the tab is closed or reloaded
with unsent changes).

## 2. Offline fallback page

### `public/offline.html`

- Self-contained: inline CSS (app colours, light and dark via `prefers-color-scheme`), the logo
  (`/logo.png`, precached with `public/`), no external requests.
- Language from the `NEXT_LOCALE` cookie, then `navigator.language`, then English; texts for en, fr,
  es, it and pt inline in a small script.
- Content: "You're offline. This screen needs a connection." and two buttons:
  - **Back to the live match**: navigates to `sessionStorage["volleystats:last-live-match"]`; when
    absent, `history.back()`. Never `/matches`, which would fail again offline.
  - **Retry**: `location.reload()` (weak signal).
- Precached by Serwist's default `public/**/*` glob: no route configuration change.

### Service worker (`app/sw.ts`)

```ts
fallbacks: {
  entries: [{ url: "/offline.html", matcher: ({ request }) => request.destination === "document" }],
},
```

Only failed document requests get the fallback. A client-side navigation whose RSC fetch fails
falls back to a full page load (seen in the reproduction), so it lands here too.

### Live page

On load, the live page stores its URL (path and query) in
`sessionStorage["volleystats:last-live-match"]`.

## 3. Testing

### E2E (Playwright)

New `tests/e2e/04g-leave-live-match.spec.ts`, built on `createAndStartMatch` and
`setupCourtPositions` with the 01-teams fixture:

1. Live page, header **Teams**: the dialog appears; **Stay** keeps the URL on `/live` and a point
   still registers.
2. Header **Matches**, **Leave**: the matches page is shown.
3. Offline, score a point, header link: the dialog shows the one-unsent-change line; **Stay**.
4. Still offline, header **Teams**, **Leave**: the page shows the fallback text, not
   `chrome-error://`.
5. **Back to the live match**: the live page loads again from cache with the score intact.
6. A completed match's live page: header links navigate with no dialog.

`tests/e2e/04f-sign-out-warning.spec.ts`: signing out from the live page with unsent changes shows a
single dialog (the leave dialog with the unsent line), and confirming signs out.

Regression: specs that leave a live page through the header (search `02`, `04*`, `06`) confirm the
dialog through a new `confirmLeave(page)` helper in `tests/helpers/`.

### Manual

- Fallback page language with the `NEXT_LOCALE` cookie set to `fr`.
- Mobile sheet at phone width: the sheet closes and the dialog is usable.

## Documentation

`.claude/docs/04-offline-sync.md`: the leave guard (User Experience) and the fallback page (Service
worker).

## Out of scope

- Intercepting browser/Android Back or Forward.
- Making other screens work offline.
- Disabling navigation while offline.
