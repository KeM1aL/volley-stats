# Authentication & Authorization

## Supabase Auth Setup

**Configuration**:
- Email/password authentication
- Session persistence: cookies (@supabase/ssr) on the web target, localStorage (supabase-js) on the mobile target; the browser client comes from `platform.createSupabaseClient()`
- On web, the proxy refreshes the session cookie

**Client-side Auth** ([contexts/auth-context.tsx](contexts/auth-context.tsx)):
```typescript
interface AuthContextType {
  user: User | null  // Includes profile + team/club memberships
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
  reloadUser: () => Promise<void>
  setUser: (user: User) => void
}

// Usage in components
const { user, isLoading } = useAuth()
```

**Server-side Auth** ([lib/server/](lib/server/), web target only):
- `lib/server/supabase.ts`: service role client for privileged operations in route handlers
- `lib/server/session.ts`: `updateSession`, the cookie refresh the proxy runs
- `lib/server/report-caller.ts`: `getReportCaller` identifies the caller of `/api/v1` and `/api/import` from a Bearer token (the mobile app, via `apiFetch`) or the cookie session, with a client that reads with their own rights (RLS applies)

---

## Authorization Model

### Team-level Roles
- `owner` - Full control of team (can delete, manage all aspects)
- `coach` - Can manage team settings, view/edit matches
- `staff` - Can assist with match tracking, view team data
- `player` - Can be tracked in statistics (limited edit permissions)

### Club-level Roles
- `owner` - Full club control (can delete club, manage all members)
- `admin` - Can manage teams and members within club
- `member` - Basic access to club teams

### Authorization Pattern in Code

```typescript
// Frontend: Role checking for UI rendering
const isTeamOwner = user.team_memberships.some(
  m => m.team_id === teamId && m.role === 'owner'
)

if (isTeamOwner) {
  return <DeleteTeamButton />
}

// Backend: Enforced via RLS policies in Supabase
// Example RLS policy:
// CREATE POLICY "Users can update their own teams"
// ON teams FOR UPDATE
// USING (
//   id IN (
//     SELECT team_id FROM team_members
//     WHERE user_id = auth.uid() AND role IN ('owner', 'coach')
//   )
// );
```

---

## Protected Routes

**Client guard** ([components/auth/auth-guard.tsx](components/auth/auth-guard.tsx)): the same on both targets. `AuthGuard` wraps the app; once the session is known, a signed-out visitor on a page that is not public goes to `/auth?redirectTo=<page>` (`routes.signIn`) and comes back after signing in. Public pages (`isPublicPath` in [lib/routes.ts](lib/routes.ts)): `/`, `/auth`, `/auth/*` and `/matches/stats` (shared match statistics). `redirectTo` values are checked by `isSafeRedirectTarget` (a path inside the app, never `/auth`, `/api` or a file).

**Proxy** ([proxy.ts](proxy.ts), the Next.js 16 name for middleware; web target only, the mobile build leaves it out):
- Runs on all routes except static assets and `/serwist` (the service worker must load for logged-out visitors)
- Refreshes the Supabase session cookie (`updateSession` in [lib/server/session.ts](lib/server/session.ts))
- Turns a locale-prefixed URL (`/fr/matches`) into `/matches?lang=fr` (a redirect; the client saves the language)
- Does not redirect unauthenticated users: the client guard does

---

## Email links: `/auth/confirm`

Auth emails (sign-up confirmation, password recovery, email change, invitation) are sent by the `send-email` edge function. Their links point to the app's own `/auth/confirm?token_hash=...&type=...&next=...`, built by `buildConfirmUrl` ([supabase/functions/send-email/_confirm-url.ts](supabase/functions/send-email/_confirm-url.ts); plain TypeScript, unit-tested from the app). [app/auth/confirm/page.tsx](app/auth/confirm/page.tsx) calls `supabase.auth.verifyOtp({ token_hash, type })` in the browser, then goes to `/auth/reset-password` (recovery), or to `next` (checked with `isSafeRedirectTarget`), or to `/`. It needs no server route and no PKCE verifier on the device, so it works in any browser and, later, in the mobile app through universal links.

The old PKCE route `app/auth/callback` (`?code=`) was removed once the `send-email` function with `/auth/confirm` links was deployed (2026-10-23). `buildConfirmUrl` still ignores an old `/auth/callback` `redirect_to`.

The Supabase Auth redirect allow-list (dashboard, Authentication, URL configuration) must contain `<web origin>/` and `<web origin>/auth/reset-password`.

---

## Account deletion

Settings has a "Delete account" card ([components/settings/delete-account-card.tsx](components/settings/delete-account-card.tsx)), on both targets. It is blocked while live-match changes are still unsent (they would be lost). Changes the server refused (rejected) never upload, so when only those are left the card offers to discard them (`SyncManager.discardRejected()`, after a confirmation). For each team the user created, they hand it over to a member who has an account (searchable select) or delete it; they then type their email to confirm. The card calls the RPC `delete_my_account(decisions jsonb)` ([migration 20261015000000_account_deletion.sql](supabase/migrations/20261015000000_account_deletion.sql)) with one decision per team (`buildDecisions` in [lib/auth/delete-account.ts](lib/auth/delete-account.ts)). The function is `security definer` and acts on `auth.uid()`: it hands over or soft-deletes each team, then deletes the auth user, which removes the profile and memberships (the user foreign keys of clubs, championships, teams and team members are `on delete set null`). `parseDeleteAccountError` maps its errors (`invalid_decisions`, `invalid_new_owner`, ...). Afterwards the app signs out locally and removes the saved language keys and the local RxDB database from the device.
