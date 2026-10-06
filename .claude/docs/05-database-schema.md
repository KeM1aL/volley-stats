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
| `profiles` | Per-user profile (name, language, favorites); `id` is the auth user id | `favorite_club_id` → clubs, `favorite_team_id` → teams |
| `clubs` | Volleyball clubs/organizations | `user_id` → auth user (creator) |
| `club_members` | Club membership with role `owner` / `admin` / `member` | `club_id` → clubs, `user_id` → auth user |
| `teams` | Teams, with `status` `incomplete` / `active` / `archived`; `ext_code`/`ext_source` for imported teams | `club_id` → clubs, `championship_id` → championships |
| `team_members` | Players and staff (`role`: owner, coach, staff, player; jersey `number`, `position`, `avatar_url`) | `team_id` → teams, `user_id` → auth user (optional) |
| `championships` | Competition categories (`age_category`, `gender`, `type`) | `season_id` → seasons, `default_match_format` → match_formats |
| `seasons` | Competition seasons (`start_date`, `end_date`) | — |
| `match_formats` | Match rules: `format` (2x2, 3x3, 4x4, 6x6), `sets_to_win`, `point_by_set`, `point_final_set`, `rotation`, `decisive_point` | — |

### Match Data

| Table | Meaning | Key references |
|-------|---------|----------------|
| `matches` | Match records (`date`, `status` upcoming/live/completed, set totals, available players per side) | `home_team_id`, `away_team_id` → teams, `match_format_id` → match_formats, `championship_id` → championships, `season_id` → seasons |
| `sets` | Individual sets (`set_number`, scores, `first_lineup`, `current_lineup`, `player_roles`, server team, `status`) | `match_id` → matches, `first_server_team_id`, `server_team_id` → teams |
| `score_points` | Point-by-point scoring (`point_number`, `point_type`, `result`, running score, `current_rotation`) | `match_id`, `set_id`, `scoring_team_id`, `action_team_id` → teams, `player_id` → team_members, `player_stat_id` → player_stats |
| `player_stats` | Individual stats (`stat_type`: serve, spike, block, reception, defense; `result`: success, good, bad, error) | `match_id`, `set_id`, `team_id`, `player_id` → team_members |
| `events` | Match events: `event_type` substitution, timeout, injury, sanction, technical, comment; type-specific `details` JSON | `match_id`, `set_id` (optional), `team_id`, `player_id` |

Substitutions are `events` rows with `event_type: 'substitution'` (see `SubstitutionDetails` in [lib/types/events.ts](lib/types/events.ts)); there is no `substitutions` table.

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

RLS is enabled on the tables. Policies scope access to the user's clubs, teams and the matches involving those teams, with role-based permissions (club owners manage their clubs; team owners/editors manage players). The service role bypasses RLS. See [06-auth.md](06-auth.md) for the authorization model.

Policy SQL in the repo: [lib/supabase/schema.sql](lib/supabase/schema.sql) (initial tables and policies; it predates later migrations and still defines `substitutions`) and [lib/supabase/match_formats_rls.sql](lib/supabase/match_formats_rls.sql) (any authenticated user can read and write match formats). The live policies are managed in the Supabase project.
