# Code Organization & Patterns

## 1. API Layer (Repository Pattern)

**Location**: [lib/api/](lib/api/)

**Pattern**: Repository Pattern with DataStore abstraction. This pattern provides a clean separation between business logic and data persistence, making it easy to migrate to a separate API in the future.

### Base Interface

```typescript
// lib/api/base/data-store.ts
interface DataStore<T> {
  getAll(filters?, sort?, joins?): Promise<T[]>
  create(item: Partial<T>): Promise<T>
  get(id: string, joins?): Promise<T | null>
  update(id: string, updates: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
```

### Supabase Implementation

```typescript
// lib/api/base/supabase-data-store.ts
class SupabaseDataStore<TableName> implements DataStore<T> {
  constructor(client: SupabaseClient, tableName: string)

  // Features:
  // - Type-safe filters with operators (eq, gt, like, in, etc.)
  // - Dynamic join support via select query building
  // - Automatic error handling
  // - Filter composition (and, or)
}
```

### API Factory Pattern

```typescript
// lib/api/index.ts
export function createApi(supabaseClient: SupabaseClient) {
  return {
    teams: new TeamApi(supabaseClient),
    matches: new MatchApi(supabaseClient),
    championships: new ChampionshipApi(supabaseClient),
    clubs: new ClubApi(supabaseClient),
    seasons: new SeasonApi(supabaseClient),
  }
}

// Singleton instance
let apiInstance: ReturnType<typeof createApi> | null = null
export function getApi(): ReturnType<typeof createApi> {
  if (!apiInstance) {
    apiInstance = createApi(createClient())
  }
  return apiInstance
}
```

### Custom Hook Wrappers

```typescript
// hooks/use-team-api.ts
export function useTeamApi() {
  return getApi().teams
}

// Usage in components:
const teamApi = useTeamApi()
const teams = await teamApi.getAll({ filters: { club_id: 'abc' } })
```

**Benefits**:
- Easy to swap Supabase for REST API later
- Consistent API across all domains
- Type-safe queries
- Reusable in both client and server components

**Migration Path**: When ready to move to a separate API, only the `SupabaseDataStore` implementation needs to be replaced with `RestApiDataStore` - all consuming code remains unchanged.

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
  match: Match
  currentSet: Set
  scorePoints: ScorePoint[]
  playerStats: PlayerStat[]
  // ... other state
}
```

### Implementations

1. **SetSetupCommand** - Create/modify set lineup and rotation
2. **SubstitutionCommand** - Player substitution during set
3. **PlayerStatCommand** - Record individual stat (serve, spike, block, etc.)
4. **ScorePointCommand** - Record point with attribution and rotation update

### Usage Pattern

```typescript
// In live match component
const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory()

// Execute a command
await executeCommand(new ScorePointCommand(matchState, pointData))

// Undo last action
if (canUndo) {
  await undo()
}
```

**Key Features**:
- Full state capture for each command
- Bidirectional operations (execute/undo)
- Stack-based history (max 50 operations)
- Persisted to RxDB (works offline)
- Automatic rotation tracking in ScorePointCommand

---

## 3. State Management Strategy

**Multi-layered Approach**:

### Layer 1: Server State (Source of Truth)
- **Supabase**: Remote PostgreSQL database
- **RxDB**: Local IndexedDB mirror
- **Sync**: Bidirectional via SyncHandler

### Layer 2: Global State (React Context)
```typescript
// contexts/auth-context.tsx
interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
  reloadUser: () => Promise<void>
}

// contexts/local-database-context.tsx
interface LocalDatabaseContextType {
  database: RxDatabase | null
  isInitialized: boolean
  syncStatus: 'idle' | 'syncing' | 'error'
}
```

### Layer 3: Local State (Component-level)
- `useState` for component-specific state
- `useReducer` for complex state logic (e.g., live match state)
- URL state via Next.js `searchParams` for filters

### Layer 4: Command State (Undo/Redo)
- Command history stack
- Persisted to RxDB
- Cleared on set completion

**State Flow Example**:
```
User scores a point
  → Component calls executeCommand(ScorePointCommand)
  → Command updates local state
  → Command saves to RxDB
  → RxDB emits change event
  → SyncHandler uploads to Supabase (when online)
  → Supabase broadcasts to other connected clients
  → Other clients receive via Realtime subscription
  → SyncHandler updates their RxDB
  → Component reactively updates from RxDB query
```
