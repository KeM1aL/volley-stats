# Migration Path & Testing

## Migration Path to Separate API

When ready to migrate from Supabase REST API to a custom backend API:

### Step 1: Create REST API DataStore
```typescript
// lib/api/rest.ts (new file, alongside lib/api/supabase.ts)
class RestApiDataStore<T> implements DataStore<T> {
  constructor(private baseUrl: string, private endpoint: string) {}

  async getAll(filters?: Filter[], sort?: Sort<T>[], joins?: string[]): Promise<T[]> {
    const queryParams = buildQueryString(filters, sort, joins)
    const response = await fetch(`${this.baseUrl}/${this.endpoint}?${queryParams}`)
    return response.json()
  }

  // Implement other methods...
}
```

### Step 2: Update API Factories
Each `createXApi` factory builds its own `SupabaseDataStore`. Let it receive a `DataStore` instead, and choose the implementation in `createApi`:

```typescript
// lib/api/teams/index.ts
export const createTeamApi = (dataStore: DataStore<Team>) => ({
  getTeams: (filters?: Filter[], sort?: Sort<Team>[], joins?: string[]) => dataStore.getAll(filters, sort, joins),
  createTeam: (team: Partial<Team>) => dataStore.create(team),
  // ...
})

// lib/api/index.ts
export const createApi = (config: ApiConfig) => {
  const store = <T>(table: TableName) =>
    config.type === 'rest'
      ? new RestApiDataStore<T>(config.baseUrl, table)
      : new SupabaseDataStore(table, config.supabaseClient)

  return {
    teams: createTeamApi(store('teams')),
    matches: createMatchApi(store('matches')),
    // ...one entry per domain
  }
}
```

### Step 3: Environment Configuration
```typescript
// .env
API_TYPE=rest  # or 'supabase'
API_BASE_URL=https://api.volley-stats.com/v1
```

### Step 4: No Changes Required In
- ✅ Components (use hooks, agnostic to implementation)
- ✅ Hooks (call API methods, don't care about implementation)
- ✅ RxDB schemas (same structure)

The live match sync ([lib/rxdb/sync/](lib/rxdb/sync/)) talks to Supabase directly through `replicateSupabase`, not through the API layer, so it needs its own pull/push handlers for a new backend.

**Estimated Migration Effort**: 2-3 days for basic REST API implementation, assuming API endpoints mirror Supabase structure.

---

## Testing Strategy

E2E tests run on Playwright ([tests/e2e/](tests/e2e/), config in `playwright.config.ts`, `npm run test:e2e`). There are no unit or integration tests and Jest is not installed; the unit and integration sections below are recommendations.

### Unit Tests (recommended: Jest + React Testing Library)
```typescript
// Example: hooks/use-team-api.test.ts
import { renderHook } from '@testing-library/react'
import { useTeamApi } from './use-team-api'

describe('useTeamApi', () => {
  it('should fetch teams', async () => {
    // Mock API
    const { result } = renderHook(() => useTeamApi())
    const teams = await result.current.getTeams()
    expect(teams).toHaveLength(5)
  })
})

// Example: lib/stats/calculations.test.ts
import { calculateMVPScore } from './calculations'

describe('calculateMVPScore', () => {
  it('should calculate MVP based on weighted stats', () => {
    const stats = [/* mock player stats */]
    const { matchMVP } = calculateMVPScore(stats, players, sets)
    expect(matchMVP.player.id).toBe('player-123')
  })
})
```

### Integration Tests (recommended: RxDB + Sync)
```typescript
// Example: lib/rxdb/sync/manager.test.ts
import { SyncManager } from './manager'
import { createTestDatabase } from '../test-utils'

describe('SyncManager', () => {
  it('should pull one match into RxDB with syncMatch', async () => {
    const db = await createTestDatabase()      // memory storage
    const syncManager = new SyncManager(db, mockSupabaseClient)
    await syncManager.setUser(testUser)

    const synced = await syncManager.syncMatch('match-123')

    expect(synced).toBe(true)
    expect(await db.matches.findOne('match-123').exec()).not.toBeNull()
  })
})
```

### E2E Tests (Playwright)

Existing specs in [tests/e2e/](tests/e2e/) run in order: teams, matches, championships, live match offline/reconnect (`04-live-offline.spec.ts`), settings, match stats, and team cleanup. `auth.setup.ts` logs in and saves `playwright/.auth/user.json`; shared IDs pass between specs through `tests/fixtures/test-data.json`.

Helpers in `tests/helpers/`:
- `match-setup.ts` — `createAndStartMatch()` creates a match and opens its live page
- `court.ts` — `setupCourtPositions()` fills the set lineup
- `network.ts` — `goOffline()`, `goOnline()`, `blockSupabase()`

Use `04-live-offline.spec.ts` as the template for offline scenarios.

`playwright.config.ts` runs one worker, sequentially, against `BASE_URL` (default `http://localhost:3000`) with no `webServer`, so start the app first. Test credentials load from `.env.test` (then `.env.test.local`, `.env.local`, `.env`).
