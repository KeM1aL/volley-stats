# Archive Matches and Teams, Set-Start Roles, Small Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five issues found while testing `feature/static-export`: dialog selects that overflow,
untranslated member roles, wrong or missing roles at set start, team deletion (becomes archiving), and
match deletion (real delete before the match starts, archive after).

**Architecture:** Teams reuse their existing `status = 'archived'`. Matches get `archived_at` (server only,
not in the RxDB schema, so a device pushing a match never overwrites it) and a guarded
`delete_unstarted_match` RPC. Every server read of matches filters `archived_at is null`. The set-start
lineup logic moves out of `components/sets/set-setup.tsx` into a pure, unit-tested module.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres, RLS, RPC), RxDB 17, next-intl
(5 locales: en, fr, es, it, pt), Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-10-21-archive-matches-teams-and-set-roles-design.md](../specs/2026-10-21-archive-matches-teams-and-set-roles-design.md)

## Global Constraints

- Branch: `feature/static-export`. Commit after each task. Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The Supabase project is shared with production. The migration (Task 5) is applied only after the
  user says yes. The Supabase MCP server needs authorization in this session. If it isn't available,
  stop and ask the user to authorize it (`/mcp`) or to run the SQL in the dashboard and paste the result.
- Migrations must be backward compatible (old app versions keep working).
- `matches.archived_at` is **not** added to the RxDB `matchSchema`. Pull and push only carry schema
  fields (`pickSchemaFields`), so a device can never reset the archive by pushing its copy of the match.
- Every new user-facing string exists in all five locales (`pnpm i18n:check` passes).
- Two targets: no server-only import in client files. URLs come from `lib/routes.ts`.
- Follow the archived-players pattern (`components/players/player-table.tsx`, `messages/*/players.json`
  `archive.*` keys) for wording and UI shape: "Show archived (N)" toggle, Archive/Restore buttons with
  aria-labels, an `AlertDialog` confirmation.
- E2E data: teams named "E2E Team …" (the global teardown deletes them). Run the minimal e2e for each
  task during the work, and the full suites on both targets only at the end (Task 9).

## Review Focus

1. **A device scoring a match that someone archives elsewhere.** It keeps scoring offline, and its
   pushes must not unarchive the match. Task 6 adds a unit test checking that `pickSchemaFields` drops
   `archived_at` from a pushed match doc.
2. **The race between rendering the list and confirming a delete.** The match started in between. The
   RPC must refuse and the UI must say so and refresh. Task 6 has a unit test on the error mapping, and
   Task 5 checks the RPC against a `live` match.
3. **A libero in the lineup who is also picked as libero, or the reverse.** No player has two roles.
   Task 2 has unit tests.
4. **Replacing the player at a position.** The previous player must not keep a role in
   `player_roles`. Task 2 has a unit test.
5. **Team stats when the archived toggle is on.** They must never count archived matches. Task 7 has
   an e2e assertion on the wins and total before and after archiving.

---

### Task 1: Dialog selects and member role labels

**Files:**
- Modify: `components/ui/generic-select.tsx`, `components/players/player-form.tsx:115-118`
- Possibly modify: `components/ui/dialog.tsx`, the other react-select wrappers listed below
- Test: `tests/e2e/03c-ui-details.spec.ts`

The dialog content (`components/ui/dialog.tsx:45`) is `overflow-y-auto` with a viewport max height,
so react-select menus inside it get clipped or scroll. `GenericSelect` is used in dialogs by
`team-form.tsx` (status) and `delete-account-card.tsx` (per-team decision, where the e2e types in it,
so typing must keep working). The react-select wrappers `team-select*.tsx`, `club-select*.tsx`,
`championship-select*.tsx`, `match-format-select.tsx` and `season-select.tsx` are used in dialogs too
(new match, new championship). Fix them all the same way.

The fix is the builder's choice, with these requirements:
- the menu shows in full above the dialog, at 375×667 and at 1280×800;
- options can be clicked;
- clicking an option doesn't close the dialog;
- typing to filter still works.

The usual route is `menuPortalTarget={document.body}` with `menuPosition="fixed"` and a `menuPortal`
z-index above the dialog's `z-50`. Radix's modal dialog sets `pointer-events: none` on `body` and
treats clicks outside its content as "outside", so the portal needs `pointer-events: auto`. The
`DialogContent` / `AlertDialogContent` must then ignore outside-interaction events whose target is
inside a react-select menu portal (`onInteractOutside` / `onPointerDownOutside`).

- [ ] **Step 1: Write the failing e2e test** `team dialog status menu fits on screen` in `03c-ui-details.spec.ts`:
  - use viewport 375×667;
  - open the edit dialog of the run's team from `routes.teams()`;
  - open the Status combobox;
  - expect the `Archived` option to be visible, with a bounding box inside the viewport;
  - click it, and expect the dialog to still be open with the combobox showing `Archived`;
  - close the dialog without saving.
- [ ] **Step 2: Run it.** `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e --project=core -g "status menu"` (after `pnpm build && pnpm start -p 3100`). Expected: FAIL (option outside viewport or not clickable).
- [ ] **Step 3: Fix the menus** as described above.
- [ ] **Step 4: Translate member roles in `player-form.tsx`.** Use `te(\`teamMemberRole.${role}\`)` with `te = useTranslations("enums")`, as `player-table.tsx:117` already does. Check `edit-player-dialog.tsx` and `new-player-dialog.tsx` for other raw role displays.
- [ ] **Step 5: Run the new test, plus `13-account-deletion` (typing in the decision select).** Expected: PASS.
- [ ] **Step 6: Commit** `fix(ui): selects inside dialogs show their whole menu; member roles translated`.

---

### Task 2: Set lineup logic module

**Files:**
- Create: `lib/matches/set-lineup.ts`
- Test: `tests/unit/matches/set-lineup.test.ts`

**Interfaces — Produces:**
```ts
import { PlayerPosition, PlayerRole } from "@/lib/enums";

/** Roles a player on court can have (the role select's options): every PlayerRole except LIBERO. */
export const FIELD_ROLES: readonly PlayerRole[];

export interface SetLineup {
  /** Player id at each court position. */
  positions: Partial<Record<PlayerPosition, string>>;
  /** Role of each player on court, by player id. A player on court may have no entry (role missing). */
  roles: Record<string, PlayerRole>;
  /** The libero (not on court), or null. */
  liberoId: string | null;
}

export const emptyLineup: SetLineup;
/** The player's default position as a role, only if it is a field role; otherwise null. */
export function defaultFieldRole(position: string | null | undefined): PlayerRole | null;
/** Puts the player at the position. The previous player at that position leaves the court and loses
 *  their role. The player leaves any other position and stops being the libero. The role is
 *  defaultFieldRole(defaultPosition), or none. */
export function placePlayer(lineup: SetLineup, position: PlayerPosition, playerId: string, defaultPosition: string | null | undefined): SetLineup;
export function clearPosition(lineup: SetLineup, position: PlayerPosition): SetLineup;
/** Sets the role of the player at the position (no-op if the position is empty). Only FIELD_ROLES are accepted. */
export function setRole(lineup: SetLineup, position: PlayerPosition, role: PlayerRole): SetLineup;
/** Sets or clears the libero. A player on court can't become libero (returns the lineup unchanged). */
export function setLibero(lineup: SetLineup, playerId: string | null): SetLineup;
export function roleAt(lineup: SetLineup, position: PlayerPosition): PlayerRole | null;
/** Positions among `existing` that have a player but no role, in `existing` order. */
export function positionsMissingRole(lineup: SetLineup, existing: readonly PlayerPosition[]): PlayerPosition[];
/** Positions among `existing` with no player. */
export function emptyPositions(lineup: SetLineup, existing: readonly PlayerPosition[]): PlayerPosition[];
/** `player_roles` for the set: one entry per player on an existing position, plus the libero as LIBERO. */
export function toPlayerRoles(lineup: SetLineup, existing: readonly PlayerPosition[]): Record<string, PlayerRole>;
/** The positions that exist in a format ("2x2" → P1, P2; "3x3" → P1–P3; "4x4" → P1–P4; "6x6" → P1–P6). */
export function existingPositions(format: string | undefined): PlayerPosition[];
```
All functions are pure and return new objects.

- [ ] **Step 1: Write the failing tests** (`describe("set lineup")`):
  - `defaultFieldRole("setter")` → `PlayerRole.SETTER`; `defaultFieldRole("libero")`, `null` and `"unknown"` → `null`.
  - **The user's case:** placing a player whose position is `"libero"` at P3 gives `roleAt(…, P3) === null` and `positionsMissingRole(…, [P1…P6])` contains P3.
  - Placing the same player twice (P1, then P2) leaves them only at P2, with exactly one roles entry.
  - Replacing A with B at P1 removes A from `roles`, and `toPlayerRoles` has no key for A.
  - `setLibero(lineup, idOnCourt)` returns the lineup unchanged. Placing the current libero on court clears `liberoId`.
  - `setRole(lineup, P1, PlayerRole.LIBERO)` is rejected (lineup unchanged).
  - `toPlayerRoles` for a 4x4 lineup with players at P1–P4 and P5 set ignores P5, and adds the libero as `libero`.
  - `existingPositions("2x2")` → `[P1, P2]`, `existingPositions("6x6")` → `[P1…P6]`.
- [ ] **Step 2: Run them.** `pnpm vitest run tests/unit/matches/set-lineup.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `lib/matches/set-lineup.ts`.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(sets): pure set lineup model (one role per player, field roles only)`.

---

### Task 3: Set setup uses the lineup model and blocks missing roles

**Files:**
- Modify: `components/sets/set-setup.tsx`, `components/matches/live/court-diagram.tsx`
- Modify: `messages/{en,fr,es,it,pt}/matches.json` (`sets.rolesMissing`)
- Test: `tests/e2e/04h-late-player.spec.ts` or a new `tests/e2e/16-set-roles.spec.ts` (builder's choice)

**Interfaces — Consumes:** everything from Task 2.
**Produces:** a new `CourtDiagram` prop, `invalidPositions?: readonly PlayerPosition[]`. Those positions get a destructive border (`border-destructive`), which overrides the normal border but not the selected (indigo) state's width.

- [ ] **Step 1: Write the failing e2e test** `start set is blocked while a player on court has no role`:
  - on a scratch team (`createScratchTeam`, players have no position, so no default role), create a match (`createMatchByApi`), start it and open the set setup;
  - place six players without choosing roles;
  - click Start set;
  - expect `start-set-btn` to stay (no `point-btn-managed-point`);
  - expect `court-position-p1` to have the `border-destructive` class;
  - expect the message naming the positions to be visible;
  - choose a role for each, then start, and the set starts.

  Note: `tests/helpers/court.ts` already picks a role when the select shows the placeholder; the test drives the court itself.
- [ ] **Step 2: Run it.** Expected: FAIL (today the players without a role are never placed, so it fails on "all positions must be specified" or the position check).
- [ ] **Step 3: Rewire `set-setup.tsx`:**
  - replace the `lineup`/`positions`/`selectedRole` state and the placement `useEffect` with one `SetLineup` state, driven by `placePlayer` (on player pick, with `player.position`), `setRole` (role select) and `setLibero` (libero select);
  - the role select's value is `roleAt(lineup, selectedPosition) ?? ""`;
  - give its trigger `border-destructive` and `aria-invalid` when the position has a player and no role;
  - `handleComplete` uses `existingPositions(match.match_formats?.format)`, keeps the existing "all positions must be specified" toast, and then, if `positionsMissingRole` is non-empty, shows a destructive toast `sets.rolesMissing` with `{positions}` (upper-case, comma-separated, e.g. `P3, P5`) and returns;
  - `player_roles` comes from `toPlayerRoles`;
  - pass `invalidPositions={positionsMissingRole(...)}` to `CourtDiagram`;
  - keep `onAddLatePlayer` and every existing `data-testid`.
- [ ] **Step 4: Add `sets.rolesMissing`** in the five locales. en: `"Choose a role for the player at {positions}"`; fr: `"Choisis un rôle pour le joueur en {positions}"`; es/it/pt: translated the same way.
- [ ] **Step 5: Run the new test, plus `--project=live`.** Expected: PASS. `pnpm i18n:check` passes.
- [ ] **Step 6: Commit** `fix(sets): a player on court needs a role; red select and court position until chosen`.

---

### Task 4: Archive teams instead of deleting them

**Files:**
- Modify: `app/teams/page.tsx` (`handleDelete` → `handleArchive`, dialog copy), `components/teams/team-table.tsx` (Trash icon → `Archive` icon, `onDelete` → `onArchive`, aria-label `Archive {name}`)
- Modify: `components/teams/team-select-with-quick-create.tsx` (`loadOptions` adds `{ field: "status", operator: "neq", value: "archived" }`)
- Modify: `lib/api/teams/index.ts` (add `archiveTeam(teamId)` = `update(teamId, { status: "archived" })`; remove `deleteTeam` if `grep -rn deleteTeam` shows no other caller)
- Modify: `messages/*/teams.json` (archive dialog, toasts; remove the now-unused delete keys)
- Test: `tests/e2e/07-team-detail.spec.ts` (replace the `test.fail` "delete E2E team" test)

Copy (en):
- dialog title `Archive {name}?`;
- description `The team leaves the team lists and can't be picked for new matches. Its matches, players and stats are kept. You can restore it by setting its status back to Active.`;
- button `Archive`;
- toasts `Team archived` / `{name} has been archived.` / `Failed to archive the team. Please try again.`

fr: `Archiver {name} ?`, `L'équipe disparaît des listes et ne peut plus être choisie pour un nouveau match. Ses matchs, joueurs et stats sont conservés. Tu peux la restaurer en remettant son statut sur Actif.`, `Archiver`, `Équipe archivée`, `{name} a été archivée.`, `Impossible d'archiver l'équipe. Réessaie.`
es/it/pt: translated the same way.

- [ ] **Step 1: Write the failing e2e test** `archive and restore a team` (replaces the `test.fail`):
  - use a scratch team that has a match (`createScratchTeam` + `createMatchByApi`);
  - on `routes.teams()`, archive it through the row's `Archive <name>` button and confirm;
  - expect `Team archived`, and the row gone from the default list;
  - choose the `Archived` status filter: the row is back;
  - edit it, set the status to Active, save;
  - clear the filter: it's listed.
- [ ] **Step 2: Run it.** Expected: FAIL (no Archive button).
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run it, plus `--project=core`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(teams): archive instead of delete; archived teams not offered for new matches`.

---

### Task 5: Migration — `matches.archived_at` and `delete_unstarted_match`

**Files:**
- Create: `supabase/migrations/20261021000000_match_archive.sql`
- Modify: `lib/supabase/database.types.ts` (regenerate with `pnpm supabase:types`, or add `archived_at` to `matches` Row/Insert/Update and the function to `Functions` by hand if the CLI is unavailable), `lib/types.ts` (`Match.archived_at: string | null`)

- [ ] **Step 1: Read the live policies before writing the SQL.** Run
  `select tablename, policyname, cmd, roles, qual from pg_policies where tablename in ('matches','sets','score_points','player_stats','events') order by 1, 3;`
  (Supabase MCP `execute_sql`, read-only). Record the result in the commit message body.
- [ ] **Step 2: Write the migration:**
  - `alter table public.matches add column archived_at timestamptz null;`
  - `create or replace function public.delete_unstarted_match(match_id uuid) returns void language plpgsql set search_path = '' as $$ … $$;`, with this body:
    - lock the row (`select status … for update`);
    - raise `match_not_found` (errcode `P0002`) if no row is visible;
    - raise `match_started` (errcode `P0001`) if `status <> 'upcoming'`;
    - delete from `public.player_stats`, `public.score_points` and `public.sets` where `match_id = …`;
    - delete the match;
    - raise `match_not_deleted` (`42501`) if the match delete affected 0 rows.
  - **Invoker or definer:** if step 1 shows DELETE policies on `matches`, `sets`, `score_points` and `player_stats` that let the users who manage the match delete, keep the default (`security invoker`), so RLS applies. Otherwise use `security definer`, with an explicit check before deleting that `auth.uid()` passes the same rule as `canManageMatch` (Task 6): creator of either team, member of either team, or member of either team's club. Raise `42501` otherwise.
  - `revoke execute on function public.delete_unstarted_match(uuid) from public, anon; grant execute … to authenticated;`
- [ ] **Step 3: Ask the user:** "Task 5 adds a nullable `archived_at` column to `matches` and a `delete_unstarted_match` function that only deletes `upcoming` matches. Old app versions are unaffected. Apply it to the shared Supabase project now?" Only after a yes, apply it with `apply_migration` (name `match_archive`).
- [ ] **Step 4: Verify on the live project** (as a seeded e2e user, through a small script or the e2e helpers' `serverClient()`):
  - the RPC on a `live` match raises `match_started`, and the match still exists;
  - on a fresh `upcoming` match, it deletes it;
  - `select archived_at from matches limit 1` works for that user.

  Clean up what you created.
- [ ] **Step 5: Update the types.** `pnpm tsc --noEmit` passes.
- [ ] **Step 6: Commit** `feat(db): matches.archived_at and delete_unstarted_match (guarded hard delete)`.

---

### Task 6: Match removal API, permission helper, unsent guard, sync

**Files:**
- Modify: `lib/api/matches/index.ts`
- Create: `lib/matches/removal.ts`, `lib/matches/can-manage-match.ts`
- Modify: `components/matches/history/match-history-table.tsx` (use `canManageMatch`, remove the local `isMemberOfTeamOrClub`)
- Modify: `hooks/use-unsent-guard.ts` (`useMatchUnsentCount(matchId, statuses = ["pending"])`)
- Modify: `lib/rxdb/sync/manager.ts` (`forgetMatch`)
- Test: `tests/unit/matches/removal.test.ts`, `tests/unit/matches/can-manage-match.test.ts`, `tests/unit/sync/manager.test.ts` (add to it), `tests/unit/sync/helper.test.ts` or the existing `pickSchemaFields` test file

**Interfaces — Produces:**
```ts
// lib/matches/removal.ts
export type MatchRemoval = "delete" | "archive";
/** "delete" for an upcoming match, "archive" otherwise. */
export function matchRemoval(match: Pick<Match, "status">): MatchRemoval;
export type RemovalError = "started" | "notFound" | "forbidden" | "unknown";
/** Maps a Supabase/PostgREST error from delete_unstarted_match or the archive update. */
export function removalError(error: unknown): RemovalError;

// lib/matches/can-manage-match.ts (moved from match-history-table.tsx, same rule)
export function canManageMatch(user: AuthUser | null, match: Match): boolean;

// lib/api/matches/index.ts, added to createMatchApi
archiveMatch: (matchId: string) => Promise<Match>;      // update archived_at = new Date().toISOString()
restoreMatch: (matchId: string) => Promise<Match>;      // update archived_at = null
deleteUnstartedMatch: (matchId: string) => Promise<void>; // rpc("delete_unstarted_match", { match_id }); throws the error
isMatchArchived: (matchId: string) => Promise<boolean>; // select archived_at, eq id; false when not found

// lib/rxdb/sync/manager.ts
/** Stops tracking a match deleted on the server, unless it still has pending, rejected or superseded
 *  changes on this device. Runs on the lifecycle queue, like the other tracked-match writes. */
forgetMatch(matchId: string): Promise<void>;
```
`AuthUser` is the type `useAuth().user` already has; import it from where `match-history-table.tsx`
gets it. The old raw `deleteMatch` stays only if something else calls it (`grep`); otherwise remove it.

- [ ] **Step 1: Write the failing tests:**
  - `matchRemoval({status:"upcoming"})` → `"delete"`; `"live"` and `"completed"` → `"archive"`.
  - `removalError({ code: "P0001", message: "match_started" })` → `"started"`; `{ code: "P0002" }` → `"notFound"`; `{ code: "42501" }` → `"forbidden"`; `new Error("x")` → `"unknown"`.
  - `canManageMatch`: creator of the away team → true; member of the home team → true; club member of the home team's club → true; unrelated user → false; `null` → false.
  - **`pickSchemaFields`:** a match row with `archived_at` gives a doc without `archived_at` (pins the "push never unarchives" constraint).
  - **`forgetMatch`:** a tracked match with no unsent rows is no longer tracked afterwards; one with a pending row stays tracked.
- [ ] **Step 2: Run them.** `pnpm vitest run tests/unit/matches tests/unit/sync`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Run them.** Expected: PASS. `pnpm tsc --noEmit` passes.
- [ ] **Step 5: Commit** `feat(matches): removal rule, archive/restore/delete API, forgetMatch`.

---

### Task 7: Matches list — delete/archive, show archived, restore

**Files:**
- Create: `components/matches/history/match-removal-action.tsx`
- Modify: `components/matches/history/match-history-table.tsx` (action in both the card and table layouts; an `archived` badge and a Restore button for archived rows)
- Modify: `app/matches/page.tsx`:
  - load without an archived filter;
  - split into `activeMatches` / `archivedMatches` (`archived_at` null or not);
  - add a "Show archived (N)" toggle (`Switch` + label, like `player-table.tsx`);
  - the table gets `showArchived ? archivedMatches : activeMatches`;
  - `TeamStats` and `StatisticsDialog` always get `activeMatches`.
- Modify: `messages/*/matches.json` (new `removal.*` keys)
- Test: `tests/e2e/17-match-archive.spec.ts`

**Interfaces — Consumes:** Task 6 (`matchRemoval`, `removalError`, `canManageMatch`, `matchApi.*`, `forgetMatch`, `useMatchUnsentCount(id, ["pending","rejected"])`).
**Produces:** `<MatchRemovalAction match={match} onDone={() => void} />`.

`MatchRemovalAction`:
- a ghost icon button (`Trash2` for delete, `Archive` for archive), aria-label `Delete match {home} vs {away}` / `Archive match {home} vs {away}`, opening an `AlertDialog`;
- while the unsent count is > 0, the confirm button is disabled and the dialog says `This device has changes to this match that aren't uploaded yet. Wait until they're uploaded.`;
- on delete:
  - call `deleteUnstartedMatch`, then `db?.syncManager.forgetMatch(id)` (best effort, ignore errors);
  - toast `Match deleted`;
  - call `onDone`;
- on archive: `archiveMatch`, toast `Match archived` / `It no longer counts in statistics. Show archived matches to restore it.`, then `onDone`;
- on error, show a destructive toast for the `removalError` reason, then `onDone` (a refresh shows the match's real state). For `started`: `This match has started in the meantime: archive it instead.`

Copy (en):
- delete dialog: `Delete this match?` / `{home} vs {away} on {date} will be deleted for good.` / `Delete`;
- archive dialog: `Archive this match?` / `{home} vs {away} and its statistics will disappear from lists and statistics. You can restore it from "Show archived".` / `Archive`;
- restore: `Restore` (aria-label `Restore match {home} vs {away}`), toast `Match restored`;
- toggle: `Show archived ({count})`;
- badge: `Archived`.

fr:
- delete dialog: `Supprimer ce match ?` / `{home} contre {away} du {date} sera supprimé définitivement.` / `Supprimer`;
- archive dialog: `Archiver ce match ?` / `{home} contre {away} et ses statistiques disparaîtront des listes et des statistiques. Tu peux le restaurer depuis « Afficher les archivés ».` / `Archiver`;
- `Restaurer`, `Match restauré`, `Afficher les archivés ({count})`, `Archivé`;
- `Match supprimé`, `Match archivé`, `Il ne compte plus dans les statistiques. Affiche les matchs archivés pour le restaurer.`;
- `Cet appareil a des changements sur ce match qui ne sont pas encore envoyés. Attends qu'ils soient envoyés.`;
- `Ce match a démarré entre-temps : archive-le plutôt.`

es/it/pt: translated the same way.

- [ ] **Step 1: Write the failing e2e tests:**
  - `delete a match that never started`:
    - create a match with `createMatchByApi` on a scratch team;
    - on the matches list filtered to that team, delete it;
    - it's gone from the list and from "Show archived";
    - `adminClient().from('matches').select('id').eq('id', id)` returns no row.
  - `archive and restore a played match`:
    - on a scratch team, create a match by API and update it to `completed` with `home_score 3, away_score 0`;
    - filter the list to that team and read the TeamStats wins and total;
    - archive the match: it's gone, and the wins and total drop by one;
    - turn "Show archived (1)" on: the row shows with `Archived`, and TeamStats is unchanged;
    - restore it: it's back, and the stats are back.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run them, plus `--project=core`.** Expected: PASS. `pnpm i18n:check` passes.
- [ ] **Step 5: Commit** `feat(matches): delete unstarted matches, archive played ones, restore from the list`.

---

### Task 8: Archived matches everywhere else

**Files:**
- Modify: `app/teams/view/page.tsx`, `app/championships/view/page.tsx` (add `{ field: "archived_at", operator: "is", value: null }` to the match filters)
- Modify: `app/matches/stats/page.tsx`, `app/matches/score/page.tsx`. When `matchData.archived_at` is set:
  - render an archived notice (`Card`) instead of the data: `This match is archived.`;
  - add a Restore button when `canManageMatch(user, match)` (needs the teams: load `home_team`/`away_team` with the existing join syntax);
  - restoring calls `restoreMatch` and reloads;
  - skip loading sets, stats and points.
- Modify: `lib/matches/live-load-failure.ts` (reason `"archived"`), `app/matches/live/page.tsx`:
  - after a successful online sync, `if (await matchApi.isMatchArchived(matchId)) throw new LiveLoadError("archived")`;
  - errors from that check are ignored;
  - offline, no check.
- Modify: `messages/*/matches.json` (`live.left.reasons.archived`: en `This match is archived. Restore it from the match list to score it.`, fr `Ce match est archivé. Restaure-le depuis la liste des matchs pour le marquer.`; the notice strings)
- Modify: `lib/report/access.ts` (select `archived_at`; an archived match → `"match-not-found"`)
- Do not change: `lib/importers/ffvb.ts` (an archived match still counts as existing, so no duplicate is imported). Add a one-line comment there saying so.
- Test: `tests/unit/report/access.test.ts` (or the existing report access test), `tests/unit/matches/live-load-failure.test.ts`, an e2e in `17-match-archive.spec.ts`

- [ ] **Step 1: Write the failing tests:**
  - **Report access:** a match row with `archived_at` set → `"match-not-found"`.
  - **Live load failure:** `liveLoadFailureReason(new LiveLoadError("archived"))` → `"archived"`. The locale files have `live.left.reasons.archived` (the existing i18n test pattern for reasons, if there is one).
  - **E2E `an archived match's shared stats link shows the archived notice`:**
    - archive a completed scratch-team match by API;
    - open `routes.matchStats(id, { team })`: expect `This match is archived.` and a Restore button;
    - restore: the stats load;
    - open `routes.matchLive(...)` of an archived match: back on the match list with the archived toast.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run them, plus `--project=live` and `--project=stats`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(matches): archived matches hidden from team/championship views, report, live and stats pages`.

---

### Task 9: Docs and full verification

**Files:**
- Modify: `.claude/docs/05-database-schema.md` (`matches.archived_at`, `delete_unstarted_match`), `.claude/docs/07-features.md` (match delete/archive, team archive, set-start roles), `.claude/docs/04-offline-sync.md` (`archived_at` deliberately not in the RxDB schema; `forgetMatch`)

- [ ] **Step 1: Update the docs** listed above. Each gets a few lines matching the existing style.
- [ ] **Step 2: Run the checks.** `pnpm test`, `pnpm tsc --noEmit`, `pnpm i18n:check`, and the lint baseline check from CI (`node scripts/lint-report.mjs && node scripts/lint-summary.mjs test-results/lint.json --baseline docs/superpowers/notes/lint-baseline.json`). Expected: all pass.
- [ ] **Step 3: Run the full web e2e** (`pnpm build && pnpm start -p 3100`, then `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`). Expected: all pass, and `07`'s former `test.fail` now passes.
- [ ] **Step 4: Run the export e2e** as described in `.claude/docs/02-architecture.md`. Expected: all pass.
- [ ] **Step 5: Commit** `docs: match/team archiving and set-start roles`.
