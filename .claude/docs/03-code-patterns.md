# Code Organization & Patterns

## 1. API Layer (Repository Pattern)

**Location**: [lib/api/](lib/api/)

**Pattern**: Repository Pattern with DataStore abstraction. This pattern provides a clean separation between business logic and data persistence, making it easy to migrate to a separate API in the future.

### Base Interface

```typescript
// lib/api/datastore.ts
interface DataStore<T> {
  getAll(filters?: Filter[], sort?: Sort<T>[], joins?: string[]): Promise<T[]>
  create(item: Partial<T>): Promise<T>
  get(id: string, joins?: string[]): Promise<T | null>
  update(id: string, updates: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
```

`Filter` and `Sort` are defined in [lib/api/types.ts](lib/api/types.ts).

### Supabase Implementation

[lib/api/supabase.ts](lib/api/supabase.ts) — `SupabaseDataStore<TableName>` implements `DataStore`, typed from `Database` in [lib/supabase/database.types.ts](lib/supabase/database.types.ts). Constructor: `new SupabaseDataStore("teams", supabaseClient?)` (defaults to the browser client).

Features:
- Filter operators (eq, neq, gt, gte, lt, lte, like, ilike, in, is, or, and)
- Joins via `select` query building (`joins: ['championships', 'clubs']`); filters on `table.field` add `!inner` joins
- Throws on Supabase errors

### API Factory Pattern

Each domain folder exports a `createXApi(supabaseClient?)` factory that wraps a `SupabaseDataStore` and returns domain-named methods (e.g. `getTeams`, `getTeam`, `createTeam`, `updateTeam`, `deleteTeam`). [lib/api/index.ts](lib/api/index.ts) assembles them:

```typescript
// lib/api/index.ts
export const createApi = (supabaseClient: SupabaseClient) => ({
  teams: createTeamApi(supabaseClient),
  teamMembers: createTeamMembersApi(supabaseClient),
  championships: createChampionshipApi(supabaseClient),
  clubs: createClubApi(supabaseClient),
  matches: createMatchApi(supabaseClient),
  seasons: createSeasonApi(supabaseClient),
  matchFormats: createMatchFormatApi(supabaseClient),
  events: createEventApi(supabaseClient)
});

const api = createApi(supabase);   // browser client singleton
export const getApi = () => api;
```

Server code (e.g. `app/api/import/ffvb/route.ts`) calls `createApi()` with the server client from `lib/supabase/server.ts`.

### Custom Hook Wrappers

```typescript
// hooks/use-team-api.ts
export const useTeamApi = () => {
  return getApi().teams;
};

// Usage in components:
const teamApi = useTeamApi()
const teams = await teamApi.getTeams(
  [{ field: 'club_id', operator: 'eq', value: clubId }],
  [{ field: 'name', direction: 'asc' }],
  ['championships', 'clubs']
)
```

**Benefits**:
- Easy to swap Supabase for REST API later
- Consistent API across all domains
- Type-safe queries
- Reusable in client code and server route handlers

**Migration Path**: When ready to move to a separate API, replace `SupabaseDataStore` with a `RestApiDataStore` and have the `createXApi` factories receive the store instead of constructing it - hooks and components remain unchanged. See [09-migration-testing.md](09-migration-testing.md).

---

## 2. Command Pattern (Undo/Redo)

**Location**: [lib/commands/](lib/commands/)

**Purpose**: Enable undo/redo functionality during live match tracking. Critical for correcting mistakes in real-time scoring.

### Base Interface

```typescript
// lib/commands/command.ts
interface Command {
  execute(): Promise<MatchState>
  undo(): Promise<MatchState>
}

interface MatchState {
  match: Match | null
  currentSet: Set | null
  sets: Set[]
  setPoints: ScorePoint[]
  points: ScorePoint[]
  setStats: PlayerStat[]
  stats: PlayerStat[]
  setEvents: Event[]
  events: Event[]
  score: Score
}
```

`CommandHistory` (same file) holds the undo/redo stacks.

### Implementations

All in [lib/commands/match-commands.ts](lib/commands/match-commands.ts); each takes the current `MatchState` and the RxDB database:

1. **SetSetupCommand** - Insert a new set with its lineup
2. **SubstitutionCommand** - Insert a `substitution` event and update the set's `current_lineup`
3. **PlayerStatCommand** - Record individual stat (serve, spike, block, etc.); a `success` or `error` result also runs a ScorePointCommand
4. **ScorePointCommand** - Record point, update set score/server/rotation, complete set and match when won

### Usage Pattern

```typescript
// app/matches/[id]/live/page.tsx
const { localDb: db } = useLocalDb()
const { history, canUndo, canRedo } = useCommandHistory()

// Execute a command
const command = new ScorePointCommand(matchState, point, myTeam, db)
const newMatchState = await history.executeCommand(command)
setMatchState(newMatchState)

// Undo last action
const state = await history.undo()
setMatchState(state)
```

**Key Features**:
- Each command captures previous and next `MatchState`
- Bidirectional operations (execute/undo); `history.redo()` re-executes
- Stack-based history (max 50 operations), kept in memory (`useRef`) for the page session
- Commands write match data to RxDB (works offline); SyncManager replicates it to Supabase
- Automatic rotation tracking in ScorePointCommand

---

## 3. State Management Strategy

**Multi-layered Approach**:

### Layer 1: Server State (Source of Truth)
- **Supabase**: Remote PostgreSQL database. Screens other than the live match read and write it directly through the API layer hooks.
- **RxDB**: Local IndexedDB copy, scoped to reference data plus the matches tracked with `syncMatch(matchId)`. Used by live match tracking.
- **Sync**: `SyncManager` ([lib/rxdb/sync/manager.ts](lib/rxdb/sync/manager.ts)) runs RxDB replication with Supabase

### Layer 2: Global State (React Context)
```typescript
// contexts/auth-context.tsx (useAuth) — main fields
interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
  reloadUser: () => Promise<void>
  // ...see the file for the full interface
}

// components/providers/local-database-provider.tsx
// useLocalDb() returns the value of hooks/use-local-database.ts:
{
  localDb: VolleyballDatabase | null   // RxDB database with .syncManager
  isLoading: boolean
  error: Error | null
}
```

### Layer 3: Local State (Component-level)
- `useState` for component-specific state (the live match page keeps `MatchState` in `useState`)
- URL state via Next.js `searchParams` for filters

### Layer 4: Command State (Undo/Redo)
- Command history stack (`CommandHistory`)
- Held in memory for the live match page session

**State Flow Example (live match)**:
```
User scores a point
  → Component calls history.executeCommand(new ScorePointCommand(...))
  → Command writes score point / set / match changes to RxDB
  → Command returns the new MatchState; component calls setMatchState
  → SyncManager replication pushes the changes to Supabase (when online)
```
