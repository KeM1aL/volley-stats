# Offline Live Match Architecture

Only live match tracking works offline. It reads and writes RxDB, and `SyncManager` replicates RxDB with Supabase. Every other screen reads and writes live Supabase data through the API layer hooks (see [03-code-patterns.md](03-code-patterns.md)).

Keep local data scoped to what a match needs. Reference data is synced at sign-in, and match data is replicated per tracked match (`syncMatch(matchId)` tracks a match). Don't add whole-table syncs of match data: the app shouldn't load all data onto the device.

## RxDB Configuration

**Location**: [lib/rxdb/](lib/rxdb/) — [database.ts](lib/rxdb/database.ts) creates the database, [schema.ts](lib/rxdb/schema.ts) defines the schemas.

**Storage Engine**: Dexie (IndexedDB); `?storage=memory` in the URL switches to in-memory storage

**Access**: `useLocalDb()` from [components/providers/local-database-provider.tsx](components/providers/local-database-provider.tsx) returns `{ localDb, isLoading, error }`. `localDb.syncManager` is the `SyncManager` instance.

**Collections** (13: the 12 mirroring every Supabase table except `profiles`, plus the local-only `pending_changes`):
1. clubs
2. club_members
3. teams
4. team_members
5. championships
6. seasons
7. match_formats
8. matches
9. sets
10. score_points
11. player_stats
12. events (includes substitutions, as `event_type: 'substitution'`)
13. pending_changes (local only: unsent rows, see Synchronization Mechanism)

**Schema Features**:
- Primary keys: UUID strings on all tables
- Every schema has `created_at`, `updated_at` and `_deleted`
- Indexes: `created_at`, `updated_at` + domain-specific indexes (`match_id`, `set_id`, `team_id`, …)
- Validation: JSON Schema via AJV (`wrappedValidateAjvStorage`)
- Timestamps: `preInsert` hook fills missing `created_at`/`updated_at`; on update, Supabase triggers set `updated_at` server-side only for requests without `x-device-id` (API layer); sync requests keep the device's value
- Schema errors (version mismatch) in development, or with `?remove-database=true`, drop and recreate the local database, except while it holds unsent changes: the reset is then refused (`sync.guards.resetBlocked`)
- **Database generation**: the local database is named `volleystats_db_v17` (`DB_GENERATION` in [database.ts](lib/rxdb/database.ts)). RxDB major versions do not share an on-disk format, so when upgrading RxDB's major version, bump `DB_GENERATION`: older databases are deleted on startup and the live match re-syncs from Supabase (unsynced local data from the old version is lost). Never bump it while devices may hold unsent rows; see Data-loss guards. Covered by `tests/e2e/04c-rxdb-legacy.spec.ts`.

---

## Synchronization Mechanism

Design: [docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md](../../docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md).

**Location**: [lib/rxdb/sync/](../../lib/rxdb/sync/)

| File | Role |
|---|---|
| `manager.ts` | `SyncManager`: signed-in user, tracked matches, scorer claim, resume on reconnect/foreground |
| `match-sync.ts` | The five replications of one match (`matches`, `sets`, `player_stats`, `score_points`, `events`) |
| `reference-sync.ts` | Pull-only replications of reference tables |
| `replication.ts` | `replicateSupabase()`: RxDB <-> Supabase adapter (pull by `_modified` checkpoint, push row by row) |
| `pending-changes.ts` | `pending_changes` local collection: every unsent row, filled by collection hooks |
| `dependencies.ts` | Parent-first gate (foreign keys) and claim gate |
| `errors.ts` | Push error classification (temporary / permanent / superseded) |
| `conflict-handler.ts` | The scoring device wins conflicts on match data |
| `tracked-matches.ts`, `sync-state.ts` | Local documents shared by every tab |
| `scorer-claim.ts` | `claim_match_scorer` / `get_match_scorer` RPCs |
| `platform/` | `SyncPlatform` (connectivity, foreground, device id); `web.ts` for the browser |
| `status.ts` | Sync badge state |

### What gets synced

- **Reference tables** (`championships`, `seasons`, `match_formats`, `clubs`, `teams`, and `club_members`/`team_members` of the user's clubs/teams): pull-only, from sign-in.
- **Match data**: one pull+push replication per (table, tracked match), identifier `sync2_<table>_match_<matchId>`, filtered to the match; a push modifier drops other matches' rows. A match is tracked once the live page calls `syncMatch(matchId)`. Tracked matches live in the `tracked-matches` local document and are replicated **from app start on every screen**, by the leader tab only. A match leaves the list 14 days after it was last opened, once nothing of it is pending, rejected or superseded. A lost match (another device took it over) keeps its banner and superseded changes for those 14 days, so taking scoring back can discard them; after that it is no longer checked on resume and is pruned with its superseded entries (they were never going to upload). A match tracked for another account is not handed to the account that opens it while that account's changes to it are unsent on the device.
- First start after the sync rework (`upgrade.ts`): local matches the server still has are tracked and every local row of theirs is marked pending (the badge shows the rescue until each row is confirmed); `lastOpenedAt` is the match's own date, so old matches are pruned once their rescue is done. Without a session or offline, nothing is seeded and it runs again at the next start.
- `syncMatch(matchId)` waits (bounded by its timeout) for the user to be set, because the live page can call it before the provider's `setUser`.

### Local database

- The local database has exactly 13 collections: the 12 tables plus `pending_changes`. RxDB's free edition refuses more than 13 open collections per JavaScript process (error COL23; each browser tab is its own process), so adding a collection requires RxDB Premium or removing one.
- The database is created with `allowSlowCount: true`, because `pending_changes` counts filter on non-indexed fields / `$in`, which RxDB rejects on Dexie otherwise.

### Server columns and triggers

- `_modified` (all 12 tables): server-clock checkpoint, set on every insert/update. Not in local schemas; `pickSchemaFields` drops it and any other column the local schema doesn't know.
- `updated_at`: time of the last edit. Requests with `x-device-id` (sync) keep the device's value; other requests (API layer) get `now()`.
- `matches.scorer_*` + `claim_match_scorer` / `get_match_scorer`: one scoring device per match. A trigger refuses sync writes from another device (`P0001 scorer_mismatch`).

### Push rules

- Rows are sent one at a time. A row waits (up to 5 s, then retried) while a parent insert of the same match is unsent (`sets -> matches`, `player_stats/score_points/events -> sets`).
- A batch stops at the first row that must wait (for a parent insert or for an offline claim); the remaining rows are retried with the batch.
- Rows that reached a final outcome (uploaded, rejected, superseded) are not sent or reported again when their batch is retried.
- Conflicts on match data: if the device knew a previous server version, the device wins; otherwise the later `updated_at` wins.
- Errors: network/auth/server errors retry forever without counting; `parent_missing`/unknown errors count, and are rejected after 20 attempts; RLS, invalid data, schema mismatch, a missing external reference or a row deleted on the server are rejected at once and never block later rows. `scorer_mismatch` marks the match's unsent rows `superseded`.
- Rejected rows stay in `pending_changes` with a reason; the badge's **Retry** re-queues them (an entry whose row is gone from the device entirely is dropped with a warning).
- An UPDATE that matches no row while the server row is unchanged is a refusal: `rls` with a session, a temporary `auth` error without one (match tables are publicly readable, so a lost session reads the row back unchanged).
- After a claim is lost, the live page is read-only: scoring, set setup, substitutions/events and undo are blocked, because the match is no longer replicated.

### Not paused offline

Replications are never paused: RxDB's retry waits for the `online` event. Reconnecting or coming back to the foreground calls `reSync()` and re-checks scorer claims; a lost match whose server holder is this device (a take-back whose reset failed after its forced claim) has its take-back finished then.

### Data-loss guards

- Settings "clear local data" buttons are disabled while their tables have unsent rows.
- A schema-error database reset (`?remove-database=true` or dev auto-reset) is refused while the unsent hint (`volleystats:unsent-changes` in localStorage) is non-zero. The sync badge, mounted in the navigation on every page, keeps the hint up to date.
- **A future `DB_GENERATION` bump must not delete a database that still has unsent rows**: keep the old database until its `pending_changes` is empty (open it with the old schema, let its replications finish, then delete it).
- Sign-out with unsent changes asks first; local data is kept and uploads when the same user signs back in.

---

## What Works Offline

**Offline** (after the match has been opened once online so `syncMatch` could pull it):
✅ **Live match tracking** (scoring, stats, set setup)
✅ Player substitutions and other match events
✅ Undo/redo operations
✅ Cold start / reload of the live match page while offline: the service worker serves the page, `AuthProvider` uses the profile saved on the device ([lib/auth/user-cache.ts](lib/auth/user-cache.ts)), and the live page skips the blocking `syncMatch` wait (replication resumes when the connection returns)

**Requires Online**:
❌ Opening a match for the first time on a device
❌ Starting the app offline on a device that has never signed in online (no saved profile)
❌ Teams, championships, match list, settings and other non-live screens (direct Supabase via the API layer)
❌ Match statistics page from the live page (its stats button is disabled offline; the stats page itself falls back to local data)
❌ Real-time updates from other users
❌ Authentication (login/signup)
❌ Avatar uploads
❌ FFVB match imports

**Service worker** ([app/sw.ts](app/sw.ts), Serwist):
- Precaches the build's JS/CSS and runtime-caches pages, images and fonts (`defaultCache`); Supabase API calls are NetworkOnly, so non-live screens always read live data and no user data sits in Cache Storage.
- `SerwistProvider` keeps `cacheOnNavigation` on: each client-side navigation asks the worker to fetch and cache that page, which is what lets the live page load again offline (together with the saved profile, see below). It costs one extra page request per navigation.
- `reloadOnOnline` is off so reconnecting does not reload a live match.
- `skipWaiting` + `clientsClaim`: a new deploy takes over open tabs immediately. A tab still running the previous build that then goes offline and needs a chunk it never loaded can fail to load it; reload once online.
- After an RxDB major upgrade (`DB_GENERATION` bump), the new build deletes the old local databases. A tab still running the old build loses its database connection mid-session; reload it.

**Saved profile** ([lib/auth/user-cache.ts](lib/auth/user-cache.ts)): after each successful profile load, `AuthProvider` stores the user (profile + team/club memberships) in `localStorage` (`volleystats:cached-user`). It is only used when loading fails because the network is unavailable, and only for the same user id as the current session; when the connection returns the profile is reloaded in the background. It is removed on sign-out and whenever the app starts without a session.

**User Experience**:
- The sync badge (header and live page) shows "All saved", "Saving N changes...", "N changes saved on this device", "N changes couldn't be saved" (with **Retry**), or "changes from another account".
- Matches with unsent changes are flagged in the match list.
- Opening a match another device scores asks before taking over; the previous device becomes read-only and keeps its unsent changes as "not uploaded".
