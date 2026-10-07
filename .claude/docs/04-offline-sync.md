# Offline Live Match Architecture

Only live match tracking works offline. It reads and writes RxDB, and `SyncManager` replicates RxDB with Supabase. Every other screen reads and writes live Supabase data through the API layer hooks (see [03-code-patterns.md](03-code-patterns.md)).

Keep local data scoped to what a match needs. Reference data is synced at login, and match data is pulled one match at a time with `syncMatch(matchId)`. Don't add whole-table syncs of match data: the app shouldn't load all data onto the device.

## RxDB Configuration

**Location**: [lib/rxdb/](lib/rxdb/) — [database.ts](lib/rxdb/database.ts) creates the database, [schema.ts](lib/rxdb/schema.ts) defines the schemas.

**Storage Engine**: Dexie (IndexedDB); `?storage=memory` in the URL switches to in-memory storage

**Access**: `useLocalDb()` from [components/providers/local-database-provider.tsx](components/providers/local-database-provider.tsx) returns `{ localDb, isLoading, error }`. `localDb.syncManager` is the `SyncManager` instance.

**Collections** (12, mirroring every Supabase table except `profiles`):
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

**Schema Features**:
- Primary keys: UUID strings on all tables
- Every schema has `created_at`, `updated_at` and `_deleted`
- Indexes: `created_at`, `updated_at` + domain-specific indexes (`match_id`, `set_id`, `team_id`, …)
- Validation: JSON Schema via AJV (`wrappedValidateAjvStorage`)
- Timestamps: `preInsert` hook fills missing `created_at`/`updated_at`; Supabase triggers set `updated_at` server-side on update
- Schema errors (version mismatch) in development, or with `?remove-database=true`, drop and recreate the local database
- **Database generation**: the local database is named `volleystats_db_v17` (`DB_GENERATION` in [database.ts](lib/rxdb/database.ts)). RxDB major versions do not share an on-disk format, so when upgrading RxDB's major version, bump `DB_GENERATION`: older databases are deleted on startup and the live match re-syncs from Supabase (unsynced local data from the old version is lost). Covered by `tests/e2e/04c-rxdb-legacy.spec.ts`.

---

## Synchronization Mechanism

**Location**:
- [lib/rxdb/sync/manager.ts](lib/rxdb/sync/manager.ts) — `SyncManager`: decides what to replicate and tracks per-match sync state
- [lib/rxdb/sync/index.ts](lib/rxdb/sync/index.ts) — `replicateSupabase()`: RxDB replication plugin adapter for Supabase (pull and push handlers)

`getDatabase()` creates the `SyncManager` and attaches it to the database. `LocalDatabaseProvider` calls `syncManager.setUser(user)` when auth changes (stops all replications, then starts them for the new user) and `syncManager.setOnlineStatus(isOnline)` when connectivity changes (pauses replications offline, restarts them online).

### What Gets Synced

1. **At login** (`startSync`, one replication per collection):
   - `championships`, `seasons`, `match_formats`, `clubs`, `teams` — every row the user can read (RLS applies)
   - `club_members` — filtered to the clubs in `user.clubMembers`
   - `team_members` — filtered to the teams in `user.teamMembers`

2. **On demand per match** (`syncMatch(matchId)`, called by [app/matches/[id]/live/page.tsx](app/matches/[id]/live/page.tsx) when the live page loads):
   - `matches` filtered by `id = matchId`; `sets`, `score_points`, `player_stats`, `events` filtered by `match_id = matchId`
   - Replication identifiers: `sync_<collection>_chunk_<matchId>`
   - Sync state is stored in the RxDB local document `sync-state-<matchId>` (`never-synced` → `syncing` → `synced`, or `error`)
   - `syncMatch` resolves `true` once all five collections are in sync, or immediately if the match is already `synced`; it resolves `false` on error or after a 30 s timeout (`SYNC_TIMEOUT_MS`). The live page shows a toast either way and continues with local data.

### Replication (`replicateSupabase`)

- **Pull**: queries the table ordered by `updated_at, id`, using a checkpoint `{ modified: updated_at, id }` and the collection's filter. Pulls run when a replication starts or re-syncs.
- **Push**: local writes are pushed as they happen. New documents are upserted; on an insert conflict (Postgres `23505`) the server row is returned as a conflict. Updates only apply if the server row still equals the assumed master state; otherwise the server row is returned as a conflict.
- **Conflicts**: no custom conflict handler is configured, so RxDB's default handler applies (server state wins).
- **Deletes**: soft delete via `_deleted`; Supabase realtime `DELETE` events are not used. `SupabaseDataStore.delete()` in the API layer issues a hard `DELETE`, which replication does not see.
- **Realtime**: the Supabase realtime pull stream in `replicateSupabase` is commented out, so remote changes from other clients arrive on the next pull (replication start or re-sync), not live.
- **Retries**: failed replication requests retry after RxDB's `retryTime` (5 s default).
- **Multi-tab**: replication waits for leader election (`waitForLeadership: true`), so only one tab replicates.

### Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│          Live match action (Command execute/undo)       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │    RxDB     │
                  └──────┬──────┘
                         │
          RxDB replication (replicateSupabase)
                         │
          ┌──────────────┴──────────┐
          │                         │
     ┌────▼────┐               ┌────▼─────┐
     │ Online  │               │ Offline  │
     └────┬────┘               └────┬─────┘
          │                         │
          ▼                         ▼
    ┌────────────┐          ┌──────────────────┐
    │  Supabase  │          │ Replication      │
    │  - Upsert  │          │ paused; local    │
    │  - Update  │          │ writes pushed    │
    └────────────┘          │ when back online │
                            └──────────────────┘
```

### Implementation Notes

- Live match components query RxDB via `useLocalDb()`; other screens use the API layer
- Existing RxDB readers outside the live page: the match stats page (`app/matches/[id]/stats`) loads from Supabase when online and falls back to the local copy of a synced match when offline, and Settings has a manual "sync match" tool that pushes one match's local rows to Supabase
- To make a new screen work offline, scope its data to a match and load it through `syncMatch`, not a new whole-table replication
- `SyncManager` has unused helpers for syncing the user's last N matches (`updateLastMatches`, `restartDynamicSync`); their calls are commented out

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
- The live page shows a toast after `syncMatch`: ready for offline, or sync timed out / failed
- Local writes are pushed automatically when connectivity is restored; no manual sync required
