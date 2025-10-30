# Migration Path & Testing

## Migration Path to Separate API

When ready to migrate from Supabase REST API to a custom backend API:

### Step 1: Create REST API DataStore
```typescript
// lib/api/base/rest-api-data-store.ts
class RestApiDataStore<T> implements DataStore<T> {
  constructor(private baseUrl: string, private endpoint: string) {}

  async getAll(filters?, sort?, joins?): Promise<T[]> {
    const queryParams = buildQueryString(filters, sort, joins)
    const response = await fetch(`${this.baseUrl}/${this.endpoint}?${queryParams}`)
    return response.json()
  }

  // Implement other methods...
}
```

### Step 2: Update API Factory
```typescript
// lib/api/index.ts
export function createApi(config: ApiConfig) {
  const useRestApi = config.type === 'rest'

  if (useRestApi) {
    return {
      teams: new TeamApi(new RestApiDataStore(config.baseUrl, 'teams')),
      matches: new MatchApi(new RestApiDataStore(config.baseUrl, 'matches')),
      // ...
    }
  } else {
    // Existing Supabase implementation
    return {
      teams: new TeamApi(config.supabaseClient),
      // ...
    }
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
- ✅ Sync logic (same interface)

**Estimated Migration Effort**: 2-3 days for basic REST API implementation, assuming API endpoints mirror Supabase structure.

---

## Testing Strategy (Recommendations)

Currently, the project has no tests. Here's a recommended testing strategy:

### Unit Tests (Jest + React Testing Library)
```typescript
// Example: hooks/use-team-api.test.ts
import { renderHook } from '@testing-library/react'
import { useTeamApi } from './use-team-api'

describe('useTeamApi', () => {
  it('should fetch teams', async () => {
    // Mock API
    const { result } = renderHook(() => useTeamApi())
    const teams = await result.current.getAll()
    expect(teams).toHaveLength(5)
  })
})

// Example: lib/stats/calculate-mvp.test.ts
import { calculateMVP } from './calculate-mvp'

describe('calculateMVP', () => {
  it('should calculate MVP based on weighted stats', () => {
    const stats = [/* mock player stats */]
    const mvp = calculateMVP(stats)
    expect(mvp.player_id).toBe('player-123')
  })
})
```

### Integration Tests (RxDB + Sync)
```typescript
// Example: lib/rxdb/sync/sync-handler.test.ts
import { SyncHandler } from './sync-handler'
import { createTestDatabase } from '../test-utils'

describe('SyncHandler', () => {
  it('should sync local changes to Supabase', async () => {
    const db = await createTestDatabase()
    const syncHandler = new SyncHandler(db, mockSupabaseClient)

    // Create local record
    await db.teams.insert({ name: 'Test Team' })

    // Wait for sync
    await syncHandler.processQueue()

    // Verify in Supabase
    const { data } = await mockSupabaseClient.from('teams').select()
    expect(data).toContainEqual(expect.objectContaining({ name: 'Test Team' }))
  })
})
```

### E2E Tests (Playwright)
```typescript
// Example: e2e/live-match-tracking.spec.ts
import { test, expect } from '@playwright/test'

test('should track match score offline', async ({ page }) => {
  await page.goto('/matches/123/live?team=456')

  // Go offline
  await page.context().setOffline(true)

  // Score points
  await page.click('[data-testid="home-point-button"]')
  await page.click('[data-testid="away-point-button"]')

  // Verify score updated
  await expect(page.locator('[data-testid="home-score"]')).toHaveText('1')
  await expect(page.locator('[data-testid="away-score"]')).toHaveText('1')

  // Go online
  await page.context().setOffline(false)

  // Wait for sync
  await expect(page.locator('[data-testid="sync-status"]')).toHaveText('Synced')
})
```
