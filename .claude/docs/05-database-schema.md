# Database Schema

## Supabase Tables (13 total)

### Core Entities

1. **clubs** - Volleyball clubs/organizations
   ```typescript
   {
     id: uuid
     name: string
     created_at: timestamp
     updated_at: timestamp
   }
   ```

2. **club_members** - Club membership with roles
   ```typescript
   {
     id: uuid
     club_id: uuid → clubs.id
     user_id: uuid → auth.users.id
     role: 'owner' | 'admin' | 'member'
     created_at: timestamp
   }
   ```

3. **teams** - Teams belonging to clubs
   ```typescript
   {
     id: uuid
     name: string
     club_id: uuid → clubs.id
     championship_id: integer → championships.id
     avatar_url: string?
     created_at: timestamp
     updated_at: timestamp
   }
   ```

4. **team_members** - Players and staff
   ```typescript
   {
     id: uuid
     team_id: uuid → teams.id
     name: string
     number: integer
     role: 'owner' | 'coach' | 'staff' | 'player'
     position: string?
     avatar_url: string?
     created_at: timestamp
     updated_at: timestamp
   }
   ```

5. **championships** - Competition categories
   ```typescript
   {
     id: uuid (primary key)
     name: string
     type: string
     default_match_format: uuid → match_formats.id
     age_category: 'U10' | 'U12' | 'U14' | 'U16' | 'U18' | 'U21' | 'senior'
     gender: 'female' | 'male' | 'mixte'
     season_id: uuid? → seasons.id
     ext_code: string?
     ext_source: string?
     created_at: timestamp
     updated_at: timestamp
   }
   ```

6. **seasons** - Competition seasons
   ```typescript
   {
     id: integer (primary key)
     name: string
     championship_id: integer → championships.id
     start_date: date
     end_date: date
     created_at: timestamp
   }
   ```

7. **match_formats** - Match format rules
   ```typescript
   {
     id: uuid (primary key)
     description: string
     format: '2x2' | '3x3' | '4x4' | '6x6'
     sets_to_win: integer
     rotation: boolean
     point_by_set: integer
     point_final_set: integer
     decisive_point: boolean
     created_at: timestamp
     updated_at: timestamp
   }
   ```

8. **matches** - Match records
   ```typescript
   {
     id: uuid
     home_team_id: uuid → teams.id
     away_team_id: uuid → teams.id
     managed_team_id: uuid → teams.id  // Team being tracked
     match_format_id: integer → match_formats.id
     season_id: integer? → seasons.id
     date: timestamp
     location: string?
     status: 'upcoming' | 'live' | 'completed'
     created_at: timestamp
     updated_at: timestamp
   }
   ```

### Match Data Entities

9. **sets** - Individual sets within matches
   ```typescript
   {
     id: uuid
     match_id: uuid → matches.id
     set_number: integer
     home_score: integer
     away_score: integer
     lineup: json  // Player positions and rotations
     status: 'upcoming' | 'in_progress' | 'completed'
     created_at: timestamp
     updated_at: timestamp
   }
   ```

10. **substitutions** - Player substitutions during sets
    ```typescript
    {
      id: uuid
      set_id: uuid → sets.id
      player_in_id: uuid → team_members.id
      player_out_id: uuid → team_members.id
      timestamp: timestamp
      created_at: timestamp
    }
    ```

11. **score_points** - Point-by-point scoring
    ```typescript
    {
      id: uuid
      set_id: uuid → sets.id
      point_number: integer
      scoring_team: 'home' | 'away'
      home_score: integer
      away_score: integer
      rotation_state: json  // Court positions at this point
      timestamp: timestamp
      created_at: timestamp
    }
    ```

12. **player_stats** - Individual player statistics
    ```typescript
    {
      id: uuid
      set_id: uuid → sets.id
      player_id: uuid → team_members.id
      stat_type: 'serve' | 'spike' | 'block' | 'reception' | 'defense'
      outcome: 'success' | 'error' | 'good' | 'bad'
      timestamp: timestamp
      created_at: timestamp
    }
    ```

13. **events** - Match events and comments
    ```typescript
    {
      id: uuid
      match_id: uuid → matches.id
      set_id: uuid? → sets.id
      event_type: string
      description: string
      timestamp: timestamp
      created_at: timestamp
    }
    ```

## Relationships

```
clubs (1) ←→ (N) club_members
clubs (1) ←→ (N) teams
teams (1) ←→ (N) team_members
teams (1) ←→ (N) matches (as home_team_id or away_team_id)
championships (1) ←→ (N) teams
championships (1) ←→ (N) seasons
match_formats (1) ←→ (N) matches
matches (1) ←→ (N) sets
sets (1) ←→ (N) score_points
sets (1) ←→ (N) player_stats
sets (1) ←→ (N) substitutions
team_members (1) ←→ (N) player_stats
team_members (1) ←→ (N) substitutions (as player_in_id or player_out_id)
```

## Row Level Security (RLS)

All tables have RLS policies enforcing:
- Users can only access data from their clubs/teams
- Role-based permissions (owner > admin > member)
- Service role bypasses RLS for system operations
