# Archive Players — Design

**Date:** 2026-10-13
**Branch:** `fix/live-match-usability` (from `main` @ b33c734)

## Goal

Players who have played can't be deleted: `player_stats`, `events`, `score_points` and match rosters
reference their `team_members` row, so the foreign keys refuse the delete. Replace deletion with
archiving: an archived player disappears from everything used to pick players for future matches,
stays in everything about past matches, and can be restored. Archiving a member linked to an app
account also removes that account's access to the team.

This is item B of four usability issues found while using the app:

| Item | Topic | Status |
|---|---|---|
| A | Live-match sidebar caret closes the open panel | Done on this branch |
| B | Archive players instead of deleting them | This spec |
| C | Confirm before leaving the live match; offline fallback instead of a blank page | To brainstorm |
| D | Add an existing team member to the roster of a match in progress | Approved in chat; built after B |

## Decisions

| Topic | Decision |
|---|---|
| Delete button | Replaced by **Archive** for every member. No hard delete in the UI. |
| Restore | Yes, from a "Show archived (N)" toggle on the players page. |
| Representation | `team_members.archived_at timestamptz null` (null = active). Not `_deleted` (the sync tombstone: the row would vanish from devices, and past matches need it). Not a `status` enum (no other player state is planned, and no date would be kept). |
| Access | Archiving a member with a `user_id` removes that account's access to the team; restoring gives it back. |
| Own row | A user can't archive their own membership row (button hidden). |
| Local database | The column is in the RxDB player schema, migrated in place (schema version 1), so archived players can be recognised offline (needed by item D's late-player picker). |

## 1. Data model and upgrade path

### Server

- Migration `supabase/migrations/20261013000000_team_members_archived_at.sql`:
  ```sql
  ALTER TABLE team_members ADD COLUMN archived_at timestamptz NULL;
  COMMENT ON COLUMN team_members.archived_at IS
    'When the member was archived: hidden from rosters and match setup, kept in past matches, no team access. NULL = active.';
  ```
- Archive and restore are ordinary updates: the existing `_modified` and `updated_at` triggers cover them.
- Regenerate `lib/supabase/database.types.ts` (`pnpm supabase:types`); add `archived_at: string | null`
  to `TeamMember` in `lib/types.ts`.

### Local database (RxDB)

- `playerSchema` (`lib/rxdb/schema.ts`): `version: 1`, new property `archived_at: { type: ["string", "null"] }`.
- `lib/rxdb/collections.ts`: register `RxDBMigrationSchemaPlugin` (`rxdb/plugins/migration-schema`)
  and give `team_members` `migrationStrategies: { 1: (doc) => ({ ...doc, archived_at: null }) }`.
- Existing devices upgrade in place when the collection opens. No `DB_GENERATION` bump, no
  "Clear local database" screen. Safe with unsent changes: `team_members` is pull-only, so it never
  has rows in `pending_changes`.
- Without this, a schema whose hash changed at `version: 0` fails to open on every existing device
  (schema error, reset refused while changes are unsent).

### Re-pull after the upgrade

The reference pull resumes from its saved `_modified` checkpoint. A player archived on the server
before the device upgraded was already pulled without the column (`pickSchemaFields` dropped it) and
would stay active on the device.

- The reference replication identifier includes the collection's schema version:
  `sync2_${table}_v${collection.schema.version}_${user.id}_${filterKey(values)}`
  (`lib/rxdb/sync/reference-sync.ts`).
- A new identifier starts a new checkpoint, so `team_members` is fully pulled once after the upgrade.
  Every reference table's identifier format changes too, which costs each of them one full re-pull:
  small, read-only tables. Any future schema bump of a reference table is covered automatically.

## 2. Where archived players are hidden, and where they stay

Rule: hidden from every list used to choose players for future matches; shown wherever past matches
are displayed.

**Hidden** (`archived_at is null`):

| Screen | File |
|---|---|
| Team detail member list and "N members" count | `app/teams/[id]/page.tsx` |
| Players page (default view) | `app/teams/[id]/players/page.tsx` |
| Start dialog "available players" picker | `components/matches/match-start-dialog.tsx` |
| Late-player picker (item D), from RxDB | `components/matches/live/late-player-dialog.tsx` |

**Shown** (looked up by id or by past match, unfiltered): the live page roster of a match in progress
(a player archived during a match stays in that match's roster, set lineups and substitution lists),
the stats page, the score page, the history statistics dialog and the PDF report.

**Unaffected:** jersey numbers have no uniqueness rule, so an archived #7 doesn't block a new #7.

## 3. Actions and access

### Players page (`components/players/player-table.tsx`, `app/teams/[id]/players/page.tsx`)

- The Trash button becomes **Archive** (lucide `Archive`). Confirmation: "Archive {name}? They'll be
  hidden from rosters and match setup, but kept in past stats and reports. You can restore them
  later." When `user_id` is set, it adds: "They'll also lose access to this team."
- Archive: `teamMemberApi.updateTeamMember(id, { archived_at: new Date().toISOString() })`. The avatar
  is kept (today's delete removes it from storage).
- The Archive button is hidden on the row whose `user_id` is the signed-in user.
- A "Show archived (N)" toggle, shown only when N > 0, lists archived members after the active ones:
  greyed, with an "Archived" badge, and **Restore** (`archived_at: null`) as their only action.
- The UI no longer calls `deleteTeamMember`; the repository method stays.
- Toasts follow the existing pattern (success and error), with new keys in en, fr, es, it and pt.

### Start dialog

- Archived members are not offered.
- `MatchLineupSetup` shows "N selected (min M)" next to the picker, in the destructive colour while
  N < M. The existing error after clicking Start stays.

### Access

- `getTeamMembers(userId)` (`lib/api/users.ts`) adds `.is("archived_at", null)`. Archived memberships
  drop out of `user.teamIds`, so the managed teams and the `team_members` reference sync of that team
  stop on the user's devices.
- `checkReportAccess` (`lib/report/access.ts`) ignores memberships whose `archived_at` is set.
- RLS: `lib/supabase/schema.sql` is out of date; the live policies are in the Supabase project.
  The first implementation step lists them:
  ```sql
  SELECT tablename, policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual ILIKE '%team_members%' OR with_check ILIKE '%team_members%');
  ```
  Every policy that grants access through `team_members.user_id` is recreated in a migration with
  `AND team_members.archived_at IS NULL` on that membership. If none does, no RLS change is made and
  the plan records it. Running the query needs the Supabase connection authorised, or the output
  supplied by the user.
- The scorer claim RPCs don't check team membership (RLS does): no change.

### Edge cases

- An archived user who is offline keeps what is already on the device until the app reloads their
  profile online (the saved profile in `lib/auth/user-cache.ts` is refreshed when the connection returns).
- Unsent match rows of an archived scorer are then refused by RLS and shown as "couldn't be saved"
  in the sync badge, like any loss of access.

## 4. Testing

### Unit (Vitest)

- `tests/unit/sync/player-schema-migration.test.ts`: a test database created with the version-0 player
  schema and one player, reopened with version 1, still has the player, with `archived_at: null`.
- Reference re-pull (`tests/unit/sync/reference-sync.test.ts`, with `fake-supabase`): rows pulled under
  the old identifier; a row archived on the fake server is not seen by the old checkpoint; starting
  with the versioned identifier pulls it with `archived_at` set.
- `tests/unit/report/load-access.test.ts`: an archived membership gives `forbidden`, unless the user
  created the team or is an owner/admin of its club.

### E2E (Playwright)

- `tests/e2e/01b-player-archive.spec.ts` (separate, so 02 keeps its 8 active players): add a player,
  archive it (gone from the players page and the team page count), "Show archived (1)" shows it with
  the badge, restore it (back), archive it again.
- `tests/e2e/02-matches.spec.ts`: the archived player isn't offered in the start dialog; the
  "N selected (min M)" line follows the ticks.
- Item D's spec: the late-player picker doesn't offer the archived player.

### RLS

If section 3 changes policies: a SQL check as an archived user (`SET LOCAL ROLE authenticated` with
`request.jwt.claims`) that the team's rows are no longer visible, and visible again after restore.

### Manual

On a device that already holds the version-0 local database with a tracked match: the app upgrades
without the "Clear local database" screen, the match still opens offline, and an archived player is
flagged after the re-pull.

## Documentation

- `.claude/docs/05-database-schema.md`: `team_members.archived_at`.
- `.claude/docs/04-offline-sync.md`: reference replication identifiers include the schema version;
  schema changes of synced collections need a version bump with a migration strategy.

## Out of scope

- Hard delete of players who never played.
- Archiving staff separately from players (one rule for every member).
- Changes to `deleteTeamMember` in the repository.
