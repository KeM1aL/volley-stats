# Audit of user foreign keys and policies before account deletion

Date: 2026-10-15. Project `gvtjccisbwrwpjtabnyd` (VolleyStats, shared with production). Read-only `select` queries only; the results contain schema, no secret values.

Goal of the next migration: deleting an `auth.users` row removes the person (auth user, profile, memberships) and keeps team data (players, matches, stats).

## Method note

The brief's `information_schema` query returns no rows: `constraint_column_usage` only lists tables owned by the querying role, and `auth.users` is owned by `supabase_auth_admin`. The foreign keys below come from `pg_constraint` instead (all FKs in `public` that reference `auth.users` or `public.profiles`).

## Foreign keys on user columns

No table references `public.profiles`. Every user FK points to `auth.users`.

| Table | Column | Constraint | Delete rule | Nullable | Blocks deleting a user today |
|---|---|---|---|---|---|
| `championships` | `user_id` | `championships_user_id_fkey` | NO ACTION | NO | yes |
| `clubs` | `user_id` | `clubs_user_id_fkey` | NO ACTION | NO | yes |
| `teams` | `user_id` | `teams_user_id_fkey` | NO ACTION | YES | yes |
| `team_members` | `user_id` | `team_members_user_id_fkey` | NO ACTION | YES | yes |
| `club_members` | `user_id` | `club_members_user_id_fkey` | CASCADE | NO | no (membership removed) |
| `profiles` | `id` | `profiles_id_fkey` | CASCADE | NO | no (profile removed) |
| `matches` | `scorer_user_id` | `matches_scorer_user_id_fkey` | SET NULL | YES | no |

To delete a user and keep the data:
- `clubs.user_id` and `championships.user_id` are `NOT NULL` with NO ACTION: the column must become nullable and the FK `ON DELETE SET NULL` (or the rows must be reassigned first).
- `teams.user_id` and `team_members.user_id` are already nullable, so only the rule needs to change to `ON DELETE SET NULL`. Setting `team_members.user_id` to null keeps the player row (the person becomes an unlinked player), which matches "keep players".

## Policies that depend on creator columns

Query: `pg_policies` where `qual` or `with_check` contains `user_id`. Ten policies match. Only `teams.user_id` is used as a creator column in policy conditions.

### No policy uses `clubs.user_id` or `championships.user_id`

`clubs` has one policy (`Enable read access for all users`, SELECT, `true`). `championships` has two (`Enable read access for all users`, SELECT, `true`; `Enable insert for authenticated users only`, INSERT, with_check `true`). `club_members` has one (`Enable read access for all users`, SELECT, `true`). No policy anywhere in `public` references `club_members`, `clubs` or `championships` in its condition (checked with `qual`/`with_check` ilike). So nulling `clubs.user_id` or `championships.user_id` changes no RLS outcome. A club owner (through `club_members`) has no write policy on clubs today, with or without the creator column.

### Policies on `teams.user_id` (all become false once `teams.user_id` is null)

For each, a club owner through `club_members` gains nothing: no policy grants write access through `club_members`, so after the team's `user_id` is null nobody can use these write paths through the API, except `service_role` (bypasses RLS).

1. `teams` / `Users can delete their own teams` (DELETE): `(auth.uid() = user_id)`. Nobody can delete the team through the API afterwards.
2. `teams` / `Users can update their own teams` (UPDATE): `(auth.uid() = user_id)`. Nobody can update the team afterwards.
3. `team_members` / `Users can manage players from their teams` (ALL): `(EXISTS ( SELECT 1 FROM teams WHERE ((teams.id = team_members.team_id) AND (teams.user_id = auth.uid()))))`. Nobody can add, edit or remove players afterwards.
4. `matches` / `Users can manage matches involving their teams` (ALL): `(EXISTS ( SELECT 1 FROM teams WHERE (((teams.id = matches.home_team_id) OR (teams.id = matches.away_team_id)) AND (teams.user_id = auth.uid()))))`. Nobody can manage the team's matches afterwards (INSERT stays open to any authenticated user through `Enable insert for authenticated users only`).
5. `sets` / `Users can manage sets for their matches` (ALL): `(EXISTS ( SELECT 1 FROM (matches JOIN teams ON (((teams.id = matches.home_team_id) OR (teams.id = matches.away_team_id)))) WHERE ((matches.id = sets.match_id) AND (teams.user_id = auth.uid()))))`. Same effect for sets.
6. `score_points` / `Users can manage score points for their matches` (ALL): same condition on `score_points.match_id`. Same effect.
7. `player_stats` / `Users can manage player stats for their matches` (ALL): same condition on `player_stats.match_id`. Same effect.
8. `events` / `User can manage events involving their team` (ALL): same condition on `events.match_id`. Same effect.

All eight have `with_check` null (the `USING` expression also applies to writes).

Consequence: a team whose creator deletes their account becomes read-only for everyone (SELECT stays `true` on all of these tables) until an owner is assigned. The migration should reassign `teams.user_id` to another owner where one exists (for example a `team_members` row with role `owner`/`coach` and a non-null `user_id`), or change these policies to check team-level membership (`team_members.user_id = auth.uid()` with role owner/coach) instead of `teams.user_id`.

### Policies on `team_members.user_id`

- `voice_vocabulary` / `Team members can read vocab` (SELECT): `((scope = 'admin'::text) OR (team_id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = auth.uid()))))`.
- `voice_vocabulary` / `Team owners can manage team vocab` (ALL), condition and with_check: `((scope = 'team'::text) AND (team_id IN ( SELECT team_members.team_id FROM team_members WHERE ((team_members.user_id = auth.uid()) AND ((team_members.role)::text = ANY ((ARRAY['owner'::character varying, 'coach'::character varying])::text[]))))))`.

These stop applying to a deleted user once `team_members.user_id` is null, which is the intended result. They also show an alternative owner source: the remaining owner/coach `team_members` rows.

### Other policies noticed (not user-column based)

- `matches` / `service_role_update_matches` (UPDATE): `true`. The condition itself does not restrict the role; worth checking separately, not part of this task.
- `profiles`: SELECT and UPDATE only, on `(( SELECT auth.uid() AS uid) = id)`. No DELETE policy; the cascade from `auth.users` removes the row.

## Triggers

Triggers in `public` (from `information_schema.triggers`) are `set_*_modified` (`set_modified_column()`), `update_*_updated_at` (`update_updated_at_column()`) and `enforce_*_scorer` (`enforce_match_scorer()`) on the match tables. `enforce_match_scorer` compares `scorer_device_id` with the request device header; it does not reference user ids.

Triggers that create owner memberships or profiles:
- `teams_add_owner_after_insert` on `teams`: `AFTER INSERT ... EXECUTE FUNCTION add_team_owner_trigger()` (SECURITY DEFINER). It inserts `team_members (team_id, user_id, role, name)` with `NEW.user_id`, role `'owner'` and the name `NEW.name`, else the profile name, else `'Owner'`, unless an owner row for that user already exists. It then sets `profiles.favorite_team_id` to the new team if neither `favorite_team_id` nor `favorite_club_id` is set. So the team creator gets one `team_members` owner row; deleting the user leaves that row (with a null `user_id` after the FK change) as an unlinked owner-named player.
- No trigger on `clubs` adds the creator to `club_members`; the only triggers on `clubs` and `club_members` are `set_*_modified` and `update_*_updated_at`. Club owner memberships are written by the application.
- `on_auth_user_created` on `auth.users`: `AFTER INSERT ... EXECUTE FUNCTION handle_new_user()`, which inserts the `profiles` row (`id`, `last_name`, `first_name` from `raw_user_meta_data`).

## RLS coverage

RLS is enabled on all 14 tables in `public` (the 13 documented plus `voice_vocabulary`).
