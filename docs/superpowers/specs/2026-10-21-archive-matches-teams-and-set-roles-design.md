# Archive Matches and Teams, Set-Start Roles, Small Fixes — Design

**Date:** 2026-10-21
**Branch:** `feature/static-export` (the user is testing this branch before merging; these fixes land
on it rather than on a new branch)

## Goal

Five issues the user found while using the app. Not all of them are related to the static export.

| # | Issue | Size |
|---|---|---|
| 1 | Team dialog: the status select's list doesn't fit in the dialog and shows wrongly | small |
| 2 | No way to delete a match | project (migration, every match read site) |
| 3 | Deleting a team fails (`matches_home_team_id_fkey`) and would remove data in bulk if it didn't | small |
| 4 | Player form: the role select shows untranslated values | small |
| 5 | Set start: a player can end up on court with a wrong role or none, and roles are recorded twice | medium |

Same principle as archived players ([2026-10-13-archive-players-design.md](2026-10-13-archive-players-design.md)):
anything that has been played is never deleted. It is archived: it leaves the lists and pickers, and
it can be restored.

## 1. Team dialog status select

The status select in the team dialog (`components/teams/team-form.tsx`, `GenericSelect`) opens a list
that doesn't fit inside the dialog and shows wrongly. Fix it so that the list shows in full at every
viewport size the app supports (phone portrait included). How is left to the builder. Check whether
other selects in dialogs share the cause (`GenericSelect` is used elsewhere) and fix them the same way.

## 2. Delete or archive a match

### Behavior (decided with the user)

- A **match that never started** is deleted for real. "Never started" means status `upcoming` (Claude's
  call, see below).
  - The confirmation is a simple "delete this match?".
  - There is no restore.
- A **match that started** (status `live` or `completed`) is archived.
  - The confirmation says the match and its statistics will disappear from everywhere, and that it
    can be restored.
- **An archived match disappears everywhere** (the user's words: as if it had never been played):
  - the matches list, team view, championship view and history;
  - team statistics (wins, points, totals) and any player statistics aggregated over matches;
  - match pickers.

  Its rows (sets, score points, player stats, events) stay untouched in the database.
- **Restore:** same model as archived players. A "Show archived (N)" toggle on the matches list
  shows archived matches, each with a **Restore** action.
  - With the toggle on, archived matches appear in the list only, marked as archived.
  - Statistics never count them.

### Decisions (Claude's calls, not discussed with the user)

| Topic | Decision |
|---|---|
| Where | A delete/archive action in each match row's actions cell (`components/matches/history/match-history-table.tsx`), next to the existing start/edit/stats action. The label follows the rule above: "Delete" or "Archive". |
| Who | The users who can already act on the match: the row's actions are shown to members of either team's team or club (`isMemberOfTeamOrClub`), and RLS decides what they may update or delete. If RLS lets any member delete a match, restrict archive and delete to the same people who may update it. |
| "Never started" = status `upcoming` | Not "no set exists". Once the start dialog is confirmed (status `live`), a device holds the scorer claim and may have scored offline; the server can't see that yet, so deleting would lose that data and leave the device pushing into a missing match. A `live` match without sets is therefore archived, not deleted. If an `upcoming` match has soft-deleted (`_deleted`) children left by an undo, the delete removes them too: `sets`, `score_points` and `player_stats` reference `matches` without `ON DELETE CASCADE` (only `events` cascades). |
| Server guard | The migration also adds an RPC, e.g. `delete_unstarted_match(match_id uuid)`, `SECURITY INVOKER` so RLS applies. In one transaction it checks the match is `upcoming` (and raises otherwise), deletes its leftover children, then the match. The app calls it instead of the raw `deleteMatch` `.delete()`. A set created between the list rendering and the confirmation then can't cause a hard delete. Archive and restore are plain updates of `archived_at` under the existing update policy. |
| Representation | `matches.archived_at timestamptz null` (null = not archived), like `team_members.archived_at`. Not `_deleted` (the sync tombstone would remove the rows from devices and look final). Not the `status` enum (it describes the game's progress). |
| Migration | Backward compatible: a nullable column and the RPC above. Old app versions ignore both. The Supabase project is shared with production, so apply it only after the user says yes. |
| Unsent changes | Archive and delete are refused while this device has unsent changes for the match (pending or rejected), with a message saying so. This reuses the existing per-match unsent count. |
| Match open on a device | The live, score and stats pages of an archived match don't show it as a normal match. When opened online, the live page sends the user back to the matches list with a toast saying the match is archived (the existing toast-on-redirect path). The stats and score pages show a notice that the match is archived instead of its data (the stats page is the public shared-link page, and "disappears everywhere" includes old shared links), with Restore for users allowed to restore it. Offline, the live page keeps working from local data: archive is refused while there are unsent changes, so nothing scored offline is lost. |
| Hard delete and sync | Only `upcoming` matches are deleted, so no device has scored in them. Still, a device that opened one (and tracks it with `syncMatch`) must not keep a ghost: no retry loop, no entry in the sync badge, no local rows that resurface it. The deleting device drops it at once. Other devices drop it when the server reports it missing, but only if they have no pending or rejected rows for it. `lib/rxdb/sync/upgrade.ts` only does such a check once, after the sync upgrade, so this recurring check is new code. |
| RxDB | No local schema change is needed for archiving: pull keeps only schema fields. The offline live page doesn't need to know a match is archived. If the builder finds a screen that reads matches from RxDB and must hide archived ones, add `archived_at` to the local schema with a migration strategy, as was done for players. |

### Read sites to filter (non-exhaustive, found during design)

`app/matches/page.tsx`, `app/teams/view/page.tsx`, `app/championships/view/page.tsx`,
`app/matches/score/page.tsx`, `app/matches/stats/page.tsx`, `components/matches/history/*`
(`team-stats.tsx`, `statistics-dialog.tsx`), `lib/report/access.ts` and `lib/report/load.ts` (no
report for an archived match), `lib/importers/ffvb.ts` (an existing archived match still counts as
existing, so an import doesn't create a duplicate). The builder lists every match read before
changing them.

## 3. Archive a team instead of deleting it

- The teams list's **Delete** action becomes **Archive**. It sets `teams.status = 'archived'` (the value
  already exists in the `team_status` enum and in the team dialog's status select). No hard delete:
  the user said archiving alone is enough, even for a team that never played.
- The confirmation says the team leaves the lists and can be restored.
- Archived teams are already hidden by the teams list's default filter (status `active`). They show
  with the existing "Archived" status filter.
- **Restore:** set the status back to Active in the team dialog. A one-click Restore action on
  archived rows of the teams list is the builder's call.
- An archived team is not offered when creating a match.
  - Its existing matches stay where they are, with the team name.
  - Archiving a team does not archive its matches.
- `teamApi.deleteTeam` loses its UI caller. Remove it if nothing else uses it.
- The e2e test "delete E2E team", a permanent `test.fail` for the foreign key bug, becomes an archive
  test that passes.

## 4. Player role select translation

`components/players/player-form.tsx` renders the member role values raw (`{role}`). Use the existing
`enums.teamMemberRole.*` strings, and check `player-table.tsx` and the other displays of the member
role for the same problem.

## 5. Roles at set start

### What happens today (`components/sets/set-setup.tsx`)

- Picking a player copies their default position (`player.position`) into the role, whatever that
  position is.
  - The user's case: a libero played as a field player. The role became `libero`, which the role
    select doesn't offer, so the select looked empty.
  - The player was still recorded on court as libero, which skews the set's statistics (`player_roles`
    feeds the libero detection in the stat tracker and the report's role metrics).
- A player picked without a role is not placed on court, and nothing tells the user why.
- The placement effect adds the player twice to their role's list (two `setLineup` calls). The user
  saw this and it bothers them most.

### Behavior (decided with the user)

- The default position is copied into the role only when it is a field role (any role the role
  select offers). For a libero placed on court, no role is set.
- A picked player is placed on court at once, with or without a role.
- While a player on court has no role:
  - the role select of that position (when its card is open) has a red border;
  - that position on the court diagram has a red border;
  - **Start set** is blocked. A message names the positions without a role (wording is the builder's
    call, in all five locales).
- Each player appears once in the lineup, with exactly one role. The double add is fixed.
- The libero chosen in the libero select can't also be on court, and a player on court can't be
  chosen as libero (the libero list already filters players that are in the lineup; keep that true
  after the rework).

Changing the player at a position replaces the previous player's role entry (no stale role left for
a player who is no longer on court).

## Testing

- Unit tests for the set-setup lineup logic: default role rules, the libero-as-field-player case, one
  entry per player, start blocked without roles. Extract the logic from the component if that's what
  it takes to test it.
- Unit tests for whatever decides delete vs archive. The RPC is checked on the shared project after
  the user approves the migration: it refuses a `live` match and deletes an `upcoming` one.
- E2E:
  - delete a never-started match;
  - archive a played match, check it's gone from the list and the team stats, then restore it;
  - archive a team, then restore it;
  - start a set with a player without a role and check it's blocked.
- The existing e2e suites on both targets (web and export), as for the rest of the branch.

## Out of scope

Archiving championships or clubs; bulk archive; archiving a team's matches with the team; a hard
delete for teams; showing archived matches in statistics with a toggle.
