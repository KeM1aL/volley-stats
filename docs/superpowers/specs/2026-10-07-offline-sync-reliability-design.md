# Offline Sync Reliability — Design

**Date:** 2026-10-07
**Branch:** `feature/offline-sync-reliability` (from `main` @ d328ade)

## Goal

Live match data recorded on a device must always reach the server, even after
network problems and multi-day offline periods, and the server must end up with
exactly what the device recorded. Users must be able to see at a glance that
their data is safe, without stress. Every edge case is covered by automated
tests that compare server rows with device rows.

## Decisions

| Topic | Decision |
|---|---|
| Who edits match data | One scoring device per match. Its match data wins conflicts. Enforced by a scorer claim (section 7) that another device can take over after confirmation. |
| Sync engine | Stay on RxDB replication, aligned with RxDB's Supabase plugin conventions (approach "patch RxDB", not a custom outbox). |
| Mobile | A mobile version (Capacitor or Expo, undecided) will follow. The sync core must not depend on browser-only APIs (service worker, Web Locks, `window` events); platform signals go through an adapter. |
| Sync status UI | App-wide badge + match-list flags + warnings before data-losing actions. No sync details screen. |
| Existing damaged matches | No repair. Forward-only fix. The one-time upgrade step only inserts rows missing on the server and never overwrites server values (section 9). |
| Previous scorer's unsent changes after a takeover | Kept on the old device, never uploaded, shown as `superseded`. |
| Tests | Add Vitest for the sync core with a fake Supabase; extend Playwright to assert server = device. |

## Root causes found in the current code

These are the defects the design removes. Each one has a regression test (section 10).

1. **Local updates silently discarded.** The adapter uses `updated_at` as the
   replication "modified" field while `updated_at` is also in the local schema.
   The server trigger bumps `updated_at` on every UPDATE, but RxDB records the
   pushed document (with the old `updated_at`) as the assumed master state. The
   next update of the same row fails the equality check in
   `addDocEqualityToQuery`, is treated as a conflict, and RxDB's default conflict
   handler (`realMasterState` wins) overwrites the local change. Repeated updates
   to `sets` (scores, lineup, status) and `matches` (set totals, `completed`) are
   lost on both sides; the UI hides it because it renders in-memory state.
2. **Match replications killed after reconnecting from an offline start.**
   `AuthProvider.refreshFromNetwork` calls `setUser(freshUser)`; the
   `LocalDatabaseProvider` effect runs `syncManager.cleanup()` + `setUser()`,
   which cancels every replication, then restarts only the reference tables.
3. **Unsent data only uploads while the match's live page is open in the
   current session.** Match replications start only in `syncMatch(matchId)`;
   `activeMatchIds` is in memory.
4. **`setOnlineStatus` returns out of the loop** on the first replication already
   in the target state, leaving others paused.
5. **One permanent push error blocks a collection's whole queue forever**, with
   only a `console.error` (RLS, schema mismatch, `documentNotFound`).
6. **Multi-tab:** only the leader tab replicates, but match replications are
   created per tab; a live match in a non-leader tab is never uploaded.
7. **Foreign-key order:** collections push independently, so a point can reach
   the server before its set or its `player_stats` row (`23503`).
8. **Data-loss paths:** Settings "clear local data", `?remove-database=true` and
   `DB_GENERATION` bumps delete unsent rows; the manual "sync match" tool pushes
   already-reverted values.
9. **No visibility:** nothing tells the user what is still waiting to upload;
   the offline e2e test never checks the server.

## 1. Server changes (one Supabase migration)

Ships before the new app version and is backward-compatible with the current one.

- **`_modified timestamptz not null default now()`** on the 12 synced tables
  (every table except `profiles`), with an index on `(_modified, id)`.
  A `BEFORE INSERT OR UPDATE` trigger sets `NEW._modified = now()`. It is the
  pull checkpoint field and is **not** in the local RxDB schemas (RxDB plugin
  convention: `rowToDoc` drops it).
- **`updated_at` means "time of the last edit".** The existing
  `update_updated_at_column()` trigger function only sets `now()` when the
  request has no `x-device-id` header. Sync requests always carry the header
  and always send the device's edit time, so the server keeps it (and a
  re-sent identical row doesn't change it); API-layer updates from other
  screens have no header and are still bumped.
- **Scorer claim columns on `matches`:** `scorer_device_id text`,
  `scorer_user_id uuid`, `scorer_name text`, `scorer_device_label text`,
  `scorer_claimed_at timestamptz`. `scorer_name` is written at claim time from
  the caller's own profile, because RLS only lets users read their own
  profile.
- **RPC `claim_match_scorer(p_match_id uuid, p_device_id text, p_label text, p_force boolean)`**,
  `SECURITY INVOKER` (RLS applies). Atomically: if no scorer, the caller's
  device is the scorer, or `p_force` is true → set the four columns and return
  `{ claimed: true, ... }`; otherwise return `{ claimed: false, scorer_*, last_activity_at }`
  where `last_activity_at` is
  the latest `_modified` across the match row and its `sets`, `score_points`,
  `player_stats` and `events` rows.
- **RPC `get_match_scorer(p_match_id uuid)`** returns the same holder fields
  without claiming (used to detect a takeover, section 7).
- **Scorer enforcement trigger** on `sets`, `score_points`, `player_stats`,
  `events` (`BEFORE INSERT OR UPDATE`): read the `x-device-id` request header
  (`current_setting('request.headers', true)::json->>'x-device-id'`). If the
  header is present, the match has a `scorer_device_id`, and they differ →
  `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scorer_mismatch'`.
  The same check runs on `matches` updates, except when the update changes
  `scorer_device_id` itself (a claim). Requests without the header (API layer
  on other screens) are not affected.
- **Foreign keys:** no change. Verified on 2026-10-07 (see "Verification
  findings"): `player_stats.player_id` and `score_points.player_id` →
  `team_members` are `NO ACTION`, so a player with recorded stats can't be
  deleted; `events.player_id` is `SET NULL`.
- Regenerate `lib/supabase/database.types.ts` (`pnpm supabase:types`).

## 2. Replication topology

- **Adapter** (`lib/rxdb/sync/replication.ts`, replaces `index.ts`): rebased on
  `rxdb/plugins/replication-supabase` 17.6.0. Differences from the official
  plugin, and only these:
  - modified field `_modified`, deleted field `_deleted`;
  - `rowToDoc` keeps only the properties defined in the local schema (RxDB
    schemas reject unknown fields), so server-only columns such as
    `_modified` and the scorer columns, and any column added on the server
    later, never break replication (the `voice_aliases` failure class);
  - inserts use `insert` (as upstream; today's `upsert` is removed) and
    `23505` → `fetchById` → conflict;
  - per-row error classification and dependency gating (sections 4 and 5)
    instead of `Promise.all` throwing for the whole batch;
  - no realtime subscription (one scorer per match → nothing to listen for;
    pulls happen on start, reconnect and foreground);
  - sets the `x-device-id` header on every sync request (`setHeader`), so
    API-layer requests made with the same client never carry it.
- **Reference tables** (`championships`, `seasons`, `match_formats`, `clubs`,
  `teams`, `club_members`, `team_members`): pull-only replications started at
  login, filters unchanged. Restarted only when the user id or the set of
  club/team memberships changes.
- **Match tables** (`matches`, `sets`, `score_points`, `player_stats`,
  `events`): one replication per (collection, tracked match), identifier
  `sync2_<collection>_match_<matchId>`. Pull filtered to the match
  (`id = matchId` for `matches`, `match_id = matchId` otherwise). A
  `push.modifier` returns `null` for rows of other matches, so replications
  never push or echo each other's rows.
- **Tracked matches** (`lib/rxdb/sync/tracked-matches.ts`): RxDB local document
  `tracked-matches` (shared across tabs):
  `{ [matchId]: { userId, claim: 'held' | 'pending-force' | 'lost', lastOpenedAt } }`.
  - `syncMatch(matchId)` adds/refreshes the entry.
  - Every tab's `SyncManager` observes the document and creates the
    replications for every entry whose `userId` is the signed-in user;
    `waitForLeadership: true` makes RxDB run them only in the leader tab, and
    a new leader takes them over automatically. This removes bug 6.
  - Created at startup on every screen, including an offline start with the
    saved profile. This removes bug 3.
  - An entry is removed when the match has no `pending`/`rejected` entries in
    `pending_changes` and `lastOpenedAt` is older than 14 days. Its
    replications are cancelled (not removed); local rows stay.
- **`syncMatch(matchId)`** resolves `true` when the first pull of the five
  replications finishes (`awaitInSync`), `false` on error or after 30 s, as today.
  The `sync-state-<matchId>` document keeps its role for the live page.
- **Lifecycle** (`SyncManager`):
  - `setUser(user)`: no-op if the user id and memberships are unchanged (a
    profile refresh no longer stops anything; removes bug 2). User id changed
    → stop everything, start for the new user. `null` → stop replications,
    keep all local data.
  - The provider no longer calls `cleanup()` in the `setUser` effect; it is
    only called when the database is destroyed.
  - Connectivity: replications are never paused. RxDB's own retry already
    waits for the browser's `online` event, so going offline needs no action;
    going online or coming to the foreground calls `reSync()` on every
    replication. There is no pause/start loop left to exit early (removes
    bug 4).
  - Each state is tracked in a map keyed by identifier; stopping awaits
    cancellation before the map entry is removed, so a stop can't clear
    replications started after it.
- **Platform adapter** (`lib/rxdb/sync/platform/`):
  ```ts
  interface SyncPlatform {
    connectivity$: Observable<boolean>;
    foreground$: Observable<void>;
    requestPersistentStorage(): Promise<boolean>;
    getDeviceId(): Promise<string>;   // generated once, persisted
    getDeviceLabel(): string;          // e.g. "Chrome · Android"
  }
  ```
  `web.ts` uses `online`/`offline`, `visibilitychange`,
  `navigator.storage.persist()`, `localStorage` and the user agent. Capacitor
  or Expo get their own implementation later; nothing else changes.
  `requestPersistentStorage()` is called once after login.

## 3. Conflicts (`lib/rxdb/sync/conflict-handler.ts`)

Configured on the five match collections (`conflictHandler` in `addCollections`).

- `isEqual(a, b)`: deep equality ignoring `_meta`, `_rev`, `_attachments`,
  `_modified`; ISO timestamp strings compared as instants (`Z` vs `+00:00`,
  millisecond vs microsecond precision).
- `resolve({ newDocumentState, assumedMasterState, realMasterState })`:
  - `assumedMasterState` present (normal update) → `newDocumentState`
    (the scoring device wins; RxDB pushes it again against the real master).
  - `assumedMasterState` absent (retry after an interrupted push, or first
    push after the upgrade) → the document with the later `updated_at`
    (tie → `realMasterState`). A genuine unsent edit wins; a stale local copy
    never overwrites a later server correction.
- Local `preSave` hook always sets `updated_at = now()` on the five match
  collections (today it only fills missing values), so every edit carries its
  edit time.

## 4. Pending changes (`lib/rxdb/sync/pending-changes.ts`)

- New local-only RxDB collection `pending_changes` (never replicated; adding a
  collection needs no migration):
  `{ id: '<collection>:<docId>', collection, doc_id, match_id, status: 'pending' | 'rejected' | 'superseded', attempts, error_code, error_message, created_at, updated_at }`.
- `preInsert` / `preSave` / `preRemove` hooks on the five match collections
  upsert the entry with `status: 'pending'` **before** the row is written.
  Replication writes bypass collection hooks, so pulled rows are never marked.
- `sent$` of each match replication deletes the entry of each uploaded row.
- When the five replications of a match are idle and in sync, leftover
  `pending` entries for that match are deleted (they come from writes that
  failed after the entry was created).
- Badge counts and match-list flags are reactive `count()` queries
  (by `status`, optionally by `match_id`).
- **Retry** (`retryRejected(matchId?)`): bumps `updated_at` of the rejected
  rows, which marks them `pending` again and makes RxDB push them.

## 5. Push errors and foreign-key order

**Dependency gating** (`lib/rxdb/sync/dependencies.ts`):

- In-match parents (the real foreign keys): `sets.match_id → matches`;
  `player_stats.{match_id, set_id}`; `score_points.{match_id, set_id}`;
  `events.{match_id, set_id}`. `score_points.player_stat_id` has no foreign
  key, so a point never waits for its stat.
- Before sending a row, the handler looks up its parents in `pending_changes`:
  - a parent `pending` → the row is not sent (no request); it is collected as
    *waiting*;
  - a parent `rejected` or `superseded` → the row gets the same status with
    `error_code: 'parent_rejected'` / `'superseded'` and a message naming the
    parent (e.g. "depends on set 3, which couldn't be saved");
  - the match's claim is `pending-force` → every row of the match waits until
    the claim RPC succeeds;
  - the match's claim is `lost` → every row of the match is `superseded`.
- Rows of a batch are sent one at a time, in order.
- A row whose parent is pending first waits up to 5 s for the parent's
  entry to clear (parents upload in parallel through their own
  replications). If it is still pending, the handler throws a
  `PushRetryError` after the batch so RxDB retries it after `retryTime`.
- The handler keeps an in-memory map of rows accepted during a retried batch
  (doc id → accepted state) and skips them on the retry, so retries don't
  repeat requests.

**Error classification** (`lib/rxdb/sync/errors.ts`), per row:

| Class | Errors | Effect |
|---|---|---|
| Temporary | network failure / `TypeError` from fetch, timeout, `401` / `PGRST301` / `PGRST303` (expired JWT), `408`, `429`, `5xx`, `23503` whose referenced table is `matches` / `sets` / `player_stats` | Batch retried (`retryTime` 5 s; paused while offline). |
| Superseded | `P0001 scorer_mismatch` | Entry `superseded`; claim marked `lost`. |
| Permanent | `42501` (RLS), `23514`, `23502`, `22xxx`, `42703`, `PGRST204`, `23505` whose row can't be read back, `23503` whose referenced table is outside the match (e.g. `team_members`), update of a row that no longer exists on the server | Entry `rejected` with code and message; the handler moves on, so later rows keep flowing. |
| Temporary → permanent | the same row failing with `parent_missing` or an unrecognised error for 20 attempts | Entry `rejected` ("couldn't be saved after repeated attempts"). Network, auth and server errors never count, so days offline never turn into rejections. |

The referenced table of a `23503` comes from the Postgres error `details`
(`Key (player_id)=(…) is not present in table "team_members"`). Messages are
translation keys, not raw database text.

A row deleted on the server is never silently re-created: an update whose
target is missing is `rejected` ("this match/set was deleted on the server").

## 6. Auth over long offline periods

- Expired access token → temporary error; supabase-js refreshes once online
  and uploads continue without user action.
- Session lost (`SIGNED_OUT`) → `setUser(null)` stops replications; local
  rows, `tracked-matches` and `pending_changes` are kept.
- Same user signs in again → replications for their tracked matches start
  and upload.
- A different user signs in → tracked matches recorded by another user id are
  not replicated; the badge shows the "another account" state.

## 7. Scoring device per match (`lib/rxdb/sync/scorer-claim.ts`)

- Opening the live page:
  - **Online**, no scorer or this device → `claim_match_scorer(force=false)`
    silently; claim `held`.
  - **Online**, another device → dialog: "**{name}** is scoring this match on
    **{device label}** (last data received {time})" — **Cancel** (back to the
    match page) / **Take over scoring** (`force=true`). The dialog says the
    other device's unsent changes won't be uploaded.
  - **Offline**, claim `held` locally → opens normally.
  - **Offline**, no local claim → dialog: "Can't check whether someone else is
    scoring (offline). Score on this device?" Confirm → claim
    `pending-force`; the leader calls the RPC with `force=true` as soon as it
    is online, before any row of the match is pushed (section 5).
- "Last data received" = `last_activity_at` returned by the RPC. Scorer
  columns are server-only (not in the local `matches` schema), so the claim is
  never read from pulled rows.
- Detecting a takeover: the leader calls `get_match_scorer` for matches with
  claim `held` whenever it re-syncs (start, reconnect, foreground). The claim
  is `lost` when the returned `scorer_device_id` differs from this device, or
  when a push fails with `scorer_mismatch`. Then the claim
  becomes `lost`, all `pending` entries of the match become `superseded`, push
  for that match stops, and the live page turns read-only with the banner
  "Scoring was taken over by {name} on {device label} at {time}". Superseded
  rows stay on the device and are never uploaded or deleted.

## 8. User interface

**Sync badge** (`components/sync/sync-badge.tsx`, hook `hooks/use-sync-status.ts`),
in the app header (`components/navigation.tsx`) and the live match header:

| State | Shows | Condition |
|---|---|---|
| Saved | ✓ "All saved" (fades after a few seconds) | no `pending`/`rejected` entries |
| Uploading | ⟳ "Saving {n} changes…" | `pending` entries, online |
| Waiting | "{n} changes saved on this device — will upload when online" | `pending` entries, offline |
| Problem | ⚠ "{n} changes couldn't be saved" + **Retry** + short reason | any `rejected` entry |
| Other account | ⚠ "Changes from another account are waiting on this device" | tracked match with pending entries and a different `userId` |

- Tapping the badge opens a popover listing affected matches (opponent, date)
  with counts and reasons; `superseded` rows appear there as information
  ("Not uploaded: {name} took over scoring at {time}") and never put the badge
  in the Problem state.
- Toast "All your match data is saved to the server" when the queue empties
  after a reconnect.
- **Match list:** "not uploaded yet" icon on matches with `pending` entries,
  warning icon for `rejected` ones.
- **Sign out** with pending entries: confirmation dialog ("{n} changes from
  this device haven't been uploaded. They stay on this device and upload when
  you sign back in") — Cancel / Sign out anyway.
- **Leaving the live page** (tab close/reload) with pending entries:
  `beforeunload` prompt (web only).
- **Settings "clear local data"**: disabled with an explanation while the
  affected collections have pending entries.
- **`?remove-database=true`**: refused while pending entries exist (message
  explains why). A future `DB_GENERATION` bump keeps the old database until
  its pending entries are uploaded (documented in `04-offline-sync.md`).
- **Removed:** the manual "sync match" tool in Settings.
- All new strings in `messages/{en,fr,es,it,pt}`.

## 9. Upgrade of existing devices

- No `DB_GENERATION` bump: local schemas are unchanged (`_modified` is
  server-only, `pending_changes` is a new collection), so nothing is wiped.
- First launch: `tracked-matches` is seeded from existing
  matches stored locally (every match this device opened), with `userId` = the signed-in user
  and no claim (no claim means pushes are not gated; the server has no scorer
  for these matches yet, so the scorer trigger allows them; the first
  live-page open claims the match).
- New replication identifiers start fresh: every local row of a tracked match
  is offered once with no assumed master. Rows missing on the server are
  inserted (unsent points/stats/events are rescued); rows present on both
  sides follow the section 3 rule (later `updated_at` wins, so stale local
  copies don't overwrite the server). One-time cost: two requests per existing
  row.
- Old replication metadata (`sync_*` identifiers) is left in place: RxDB has
  no API to remove it without starting the old replication, and it is a few
  small documents.
- Deploy order: Supabase migration → new app version.

## 10. Testing

**Vitest** (new dev dependency; `pnpm test`; files under `tests/unit/`):

- **Fake Supabase** (`tests/unit/fakes/fake-supabase.ts`): in-memory tables
  behind a chainable client implementing exactly the PostgREST methods the
  sync code uses (`select`, `insert`, `update`, `eq`, `in`, `is`, `or`,
  `order`, `limit`, `rpc`); emulated triggers (`_modified`, `updated_at` rule,
  scorer check), FK constraints returning real `23503` details, unique
  constraint `23505`; injectable faults: offline, timeout, failure after N
  rows, commit-then-lost-response, `401` then refresh, RLS `42501`,
  `PGRST204`.
- **RxDB** with memory storage; fake `SyncPlatform` driving connectivity and
  foreground events; two `SyncManager` instances on one multi-instance
  database for the multi-tab case.
- **Scenarios** (each ends by asserting server rows = device rows, field by field):
  1. repeated updates of one set, online and offline (bug 1);
  2. reconnect after an offline cold start with a profile refresh (bug 2);
  3. restart on a non-live screen with pending data from days ago (bug 3);
  4. mixed paused/running replications on reconnect (bug 4);
  5. a permanent rejection doesn't block later rows; retry works (bug 5);
  6. live match in a non-leader tab (bug 6);
  7. FK order: point + stat recorded before their set uploads; parent rejected
     → child rejected with reason; player deleted on the server → named
     rejection (bug 7);
  8. token expired after days offline → uploads after refresh; session
     revoked → data kept, resumes for the same user; a different user can't
     upload it;
  9. interrupted push (committed, response lost) then a local edit → the
     edit wins;
  10. stale local copy vs later website correction → server wins;
  11. scorer claim: silent claim, online takeover, offline `pending-force`,
      previous device → `superseded`, server trigger rejects it;
  12. upgrade from v17 replication state → missing rows inserted, nothing
      overwritten;
  13. undo/redo offline and during a push;
  14. data-loss guards (clear local data, sign out, remove-database).

**Playwright** (existing setup, real Supabase):

- `04-live-offline.spec.ts`: after reconnecting, query Supabase and assert its
  points, stats, events, set scores and match score equal the device's.
- New: score offline → close the page → reopen `/` online → badge reaches
  "All saved" → server = device.
- New: two browser contexts → second device sees the scorer dialog, takes
  over; first becomes read-only with superseded rows.
- New: sign-out warning with pending changes.

## Verification findings (2026-10-07, read-only queries on project `gvtjccisbwrwpjtabnyd`)

- **Damage confirmed:** 11 of the 96 sets that have points (10 matches) have
  a set score that disagrees with the highest running score of their points,
  as root cause 1 predicts.
- **Foreign keys:** `sets/score_points/player_stats.match_id → matches` and
  `score_points/player_stats.set_id → sets` are `NO ACTION`; `events.match_id`
  and `events.set_id` are `CASCADE`; `player_stats/score_points.player_id →
  team_members` `NO ACTION`; `events.player_id` `SET NULL`; team references
  (`team_id`, `scoring_team_id`, `action_team_id`, `server_team_id`,
  `first_server_team_id`) → `teams`. `score_points.player_stat_id` has no FK.
- **Unique constraints** on match tables: primary keys only.
- **Triggers:** `BEFORE UPDATE … update_updated_at_column()` on every table
  (twice on `team_members`); no `_modified` column exists yet.
- **RLS:** match tables are writable by the owner of either team
  (`teams.user_id = auth.uid()`) and readable by everyone; `profiles` are only
  readable by their owner.
- `matches.date` is `timestamptz` (local copy is a string; compared as an
  instant).

## Files

| Path | Change |
|---|---|
| `supabase/migrations/<timestamp>_sync_reliability.sql` | new (section 1) |
| `lib/rxdb/sync/replication.ts` | new, replaces `index.ts` |
| `lib/rxdb/sync/helper.ts` | aligned with the official plugin |
| `lib/rxdb/sync/{errors,conflict-handler,pending-changes,dependencies,tracked-matches,scorer-claim}.ts` | new |
| `lib/rxdb/sync/platform/{types,web}.ts` | new |
| `lib/rxdb/sync/manager.ts` | rewritten around tracked matches and lifecycle rules |
| `lib/rxdb/database.ts`, `lib/rxdb/schema.ts` | `pending_changes` collection, conflict handlers, hooks |
| `components/providers/local-database-provider.tsx` | `setUser` effect without `cleanup()`, platform wiring |
| `app/matches/[id]/live/page.tsx` | scorer claim dialogs, read-only mode, badge |
| `components/sync/*`, `hooks/use-sync-status.ts` | new badge, popover, dialogs |
| `components/navigation.tsx` | badge, sign-out warning |
| `components/matches/history/match-history-table.tsx` | pending/rejected flags |
| `app/settings/page.tsx` | guards; manual sync tool removed |
| `messages/*` | new strings |
| `tests/unit/**`, `vitest.config.ts`, `package.json` | Vitest |
| `tests/e2e/04-live-offline.spec.ts` + new specs | server = device assertions |
| `.claude/docs/04-offline-sync.md` | rewritten for the new mechanism |

## Out of scope

- Repairing matches already damaged on the server.
- Realtime updates from other devices.
- Merging simultaneous scoring from two devices.
- Background upload with the app closed (service worker Background Sync).
- The Capacitor/Expo implementation of `SyncPlatform`.
- Offline support for screens other than the live match.
