# Database Schema

**Column definitions**: [lib/supabase/database.types.ts](lib/supabase/database.types.ts) is the source of truth for columns, types, enums and foreign keys. Regenerate it after schema changes with `pnpm supabase:types`. App-level types live in [lib/types.ts](lib/types.ts) and [lib/types/events.ts](lib/types/events.ts).

**Conventions**:
- All primary keys and foreign keys are UUID strings
- Every table except `profiles` has `created_at`, `updated_at` (set by a server trigger on update) and `_deleted` (soft-delete flag used by RxDB replication)
- RxDB mirrors every table except `profiles` (see [04-offline-sync.md](04-offline-sync.md))
- Migrations: [supabase/migrations/](supabase/migrations/)

## Supabase Tables (13 total)

### Core Entities

| Table | Meaning | Key references |
|-------|---------|----------------|
| `profiles` | Per-user profile (name, language, favorites, `role` `user` / `admin`, default `user`); `id` is the auth user id. The trigger `protect_profile_role` rejects a `role` set or changed by an `anon` / `authenticated` request (42501 `role_not_allowed`); the dashboard and the service role may. Admins gate the FFVB import | `favorite_club_id` → clubs, `favorite_team_id` → teams |
| `clubs` | Volleyball clubs/organizations | `user_id` → auth user (creator) |
| `club_members` | Club membership with role `owner` / `admin` / `member` | `club_id` → clubs, `user_id` → auth user |
| `teams` | Teams, with `status` `incomplete` / `active` / `archived`; `ext_code`/`ext_source` for imported teams | `club_id` → clubs, `championship_id` → championships |
| `team_members` | Players and staff (`role`: owner, coach, staff, player; jersey `number`, `position`, `avatar_url`; `archived_at`: archived members are hidden from rosters and match setup and lose team access in the app, null when active) | `team_id` → teams, `user_id` → auth user (optional) |
| `championships` | Competition categories (`age_category`, `gender`, `type`) | `season_id` → seasons, `default_match_format` → match_formats |
| `seasons` | Competition seasons (`start_date`, `end_date`) | — |
| `match_formats` | Match rules: `format` (2x2, 3x3, 4x4, 6x6), `sets_to_win`, `point_by_set`, `point_final_set`, `rotation`, `decisive_point` | — |

### Match Data

| Table | Meaning | Key references |
|-------|---------|----------------|
| `matches` | Match records (`date`, `status` upcoming/live/completed, set totals, available players per side; `archived_at`: archived matches are hidden from lists, statistics and reports and can be restored, null when active; server only, not in the RxDB schema) | `home_team_id`, `away_team_id` → teams, `match_format_id` → match_formats, `championship_id` → championships, `season_id` → seasons |
| `sets` | Individual sets (`set_number`, scores, `first_lineup`, `current_lineup`, `player_roles`, server team, `status`) | `match_id` → matches, `first_server_team_id`, `server_team_id` → teams |
| `score_points` | Point-by-point scoring (`point_number`, `point_type`, `result`, running score, `current_rotation`) | `match_id`, `set_id`, `scoring_team_id`, `action_team_id` → teams, `player_id` → team_members, `player_stat_id` → player_stats |
| `player_stats` | Individual stats (`stat_type`: serve, spike, block, reception, defense; `result`: success, good, bad, error) | `match_id`, `set_id`, `team_id`, `player_id` → team_members |
| `events` | Match events: `event_type` substitution, timeout, injury, sanction, technical, comment; type-specific `details` JSON | `match_id`, `set_id` (optional), `team_id`, `player_id` |

Substitutions are `events` rows with `event_type: 'substitution'` (see `SubstitutionDetails` in [lib/types/events.ts](lib/types/events.ts)); there is no `substitutions` table.

### App configuration

| Table | Meaning |
|-------|---------|
| `app_config` | One row per store platform (`ios`, `android`): `min_version`, `latest_version`, `store_url` (null until published). Readable by `anon` and `authenticated`, writable only from the dashboard, not replicated to RxDB, not counted in the 13 tables. Drives the update banner / block of the installed app ([11-mobile-app.md](11-mobile-app.md)). Migrations [20261023000000_app_role_and_config.sql](supabase/migrations/20261023000000_app_role_and_config.sql) and [20261023000100_protect_profile_role_empty_claims.sql](supabase/migrations/20261023000100_protect_profile_role_empty_claims.sql) |

Migrations follow the compatibility policy in [11-mobile-app.md](11-mobile-app.md) (additive only, header question about old app versions).

### Functions (RPC)

| Function | Meaning |
|----------|---------|
| `delete_unstarted_match(match_id)` | Really deletes a match that never started. `SECURITY INVOKER` (the caller's RLS applies). Refuses a match that is not `upcoming` (`P0001 match_started`; `P0002` not found; `42501` not allowed), deletes the leftover `player_stats`, `score_points` and `sets` (they have no `ON DELETE CASCADE`; `events` cascade), then the match. Migration [20261021000000_match_archive.sql](supabase/migrations/20261021000000_match_archive.sql). |

Scoring-device claim functions (`claim_match_scorer`, `get_match_scorer`) are described in [04-offline-sync.md](04-offline-sync.md).

## Relationships

```
clubs (1) ←→ (N) club_members
clubs (1) ←→ (N) teams
teams (1) ←→ (N) team_members
teams (1) ←→ (N) matches (as home_team_id or away_team_id)
championships (1) ←→ (N) teams
championships (1) ←→ (N) matches
seasons (1) ←→ (N) championships
seasons (1) ←→ (N) matches
match_formats (1) ←→ (N) matches
match_formats (1) ←→ (N) championships (default_match_format)
matches (1) ←→ (N) sets
matches (1) ←→ (N) score_points, player_stats, events (via match_id)
sets (1) ←→ (N) score_points
sets (1) ←→ (N) player_stats
sets (1) ←→ (N) events
team_members (1) ←→ (N) player_stats
team_members (1) ←→ (N) events (player_id)
```

## Row Level Security (RLS)

RLS is enabled on the tables. Policies scope access to the user's clubs, teams and the matches involving those teams, with role-based permissions (club owners manage their clubs; team owners/editors manage players). The service role bypasses RLS. Live match policies let only the creator of either team (`teams.user_id`) update or delete a match; the app mirrors this in `canRemoveMatch` ([lib/matches/can-manage-match.ts](lib/matches/can-manage-match.ts)) for archive, restore and delete, while `canManageMatch` (members of either team or club) gates start, edit and statistics. See [06-auth.md](06-auth.md) for the authorization model.

Policy SQL in the repo: [lib/supabase/schema.sql](lib/supabase/schema.sql) (initial tables and policies; it predates later migrations and still defines `substitutions`) and [lib/supabase/match_formats_rls.sql](lib/supabase/match_formats_rls.sql) (any authenticated user can read and write match formats). The live policies are managed in the Supabase project.
