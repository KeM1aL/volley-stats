# Development Guidelines

## Naming Conventions

### Files
All file names are kebab-case.
- Components: kebab-case files exporting PascalCase components
  - `components/teams/team-table.tsx`, `components/matches/live/live-match-header.tsx`
- Hooks: kebab-case files with `use-` prefix, exporting `useX` hooks
  - `hooks/use-team-api.ts` (`useTeamApi`), `hooks/use-local-database.ts`, `hooks/use-command-history.ts`
- Utilities: kebab-case
  - `lib/utils/retry.ts`, `lib/stats/calculations.ts`
- APIs: one folder per domain, `lib/api/<domain>/index.ts` exporting a `createXApi` factory
  - `lib/api/teams/index.ts` exports `createTeamApi`
- Types: [lib/types.ts](lib/types.ts) (+ [lib/types/events.ts](lib/types/events.ts)) with PascalCase type names; generated DB types in [lib/supabase/database.types.ts](lib/supabase/database.types.ts)

### Variables & Functions
- React components: PascalCase (`LiveMatchTracker`, `TeamForm`)
- Functions: camelCase (`handleScorePoint`, `calculateMVPScore`)
- Constants: UPPER_SNAKE_CASE (`MAX_PLAYERS`, `DEFAULT_POINTS`)
- Database fields: snake_case (`team_id`, `created_at`)
- Type properties: snake_case (matching database schema)

### TypeScript Conventions
- Use `interface` for object shapes
- Use `type` for unions and complex types
- Use `enum` for constants with multiple values
- Prefer `unknown` over `any`
- Always define return types for functions

---

## Error Handling Patterns

### Standard Pattern
```typescript
const { toast } = useToast()      // hooks/use-toast.ts
const t = useTranslations("...")  // next-intl; user-facing strings come from messages/

try {
  await operation()
  toast({
    title: t("toast.success"),
    description: t("toast.successDesc")
  })
} catch (error) {
  console.error("Operation failed:", error)
  toast({
    variant: "destructive",
    title: t("toast.error"),
    description: error instanceof Error ? error.message : t("toast.genericError")
  })
}
```

### Strategies by Layer

1. **UI Layer**: Toast notifications via `useToast` ([hooks/use-toast.ts](hooks/use-toast.ts)), rendered by the shadcn `<Toaster />` in [app/layout.tsx](app/layout.tsx)
   - Default variant for success/info
   - `variant: "destructive"` for errors

2. **API Layer**: Throw descriptive errors
   ```typescript
   if (!result) {
     throw new Error(`Team with ID ${id} not found`)
   }
   ```

3. **Sync Layer** (live match only): RxDB replication retries failed pull/push requests after its `retryTime` (5 s default); `SyncManager` logs errors from each replication's `error$`, and `syncMatch` resolves `false` on error or timeout so the live page can warn and continue with local data. For ad-hoc retries elsewhere, [lib/utils/retry.ts](lib/utils/retry.ts) provides `retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000)` (exponential backoff).

4. **Validation**: Zod schemas for forms
   ```typescript
   const teamFormSchema = z.object({
     name: z.string().min(1, t('validation.nameRequired')),
     championship_id: z.string().uuid().optional(),
   })

   // In form component
   const form = useForm({
     resolver: zodResolver(teamFormSchema)
   })
   ```

5. **RxDB** (live match): Schema validation via AJV
   - Automatic validation on insert/update
   - Prevents invalid data in local database

---

## API Layer Usage

### Getting API Instance
```typescript
// In client components
const teamApi = useTeamApi()
const matchApi = useMatchApi()

// In client utilities
import { getApi } from '@/lib/api'
const api = getApi()

// In route handlers (server): build an API on the server client
import { createApi } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
const api = createApi(await createClient())
```

### CRUD Operations

Each domain API exposes domain-named methods over the `DataStore` operations (see `lib/api/<domain>/index.ts` for the exact names):

```typescript
// Create
const team = await teamApi.createTeam({
  name: 'New Team',
  club_id: clubId
})

// Read (single)
const team = await teamApi.getTeam(teamId)

// Read (list): getTeams(filters?: Filter[], sort?: Sort<Team>[], joins?: string[])
const teams = await teamApi.getTeams(
  [
    { field: 'club_id', operator: 'eq', value: clubId },
    { field: 'championship_id', operator: 'in', value: championshipIds }
  ],
  [{ field: 'created_at', direction: 'desc' }],
  ['championships', 'clubs']  // Include relations
)

// Update
const updated = await teamApi.updateTeam(teamId, {
  name: 'Updated Name'
})

// Delete (hard delete in Supabase)
await teamApi.deleteTeam(teamId)
```

### Filter Operators
- `eq` (equals)
- `neq` (not equals)
- `gt` (greater than)
- `gte` (greater than or equal)
- `lt` (less than)
- `lte` (less than or equal)
- `like` (pattern match)
- `ilike` (case-insensitive pattern match)
- `in` (in array)
- `is` (is null/not null)
- `or`, `and` (raw PostgREST filter string in `value`)

### Complex Filters
```typescript
// AND: multiple filters in the array
[
  { field: 'club_id', operator: 'eq', value: clubId },
  { field: 'status', operator: 'eq', value: 'completed' }
]

// OR: PostgREST syntax
[
  { operator: 'or', value: `home_team_id.eq.${teamId},away_team_id.eq.${teamId}` }
]

// Filter on a joined table (adds an !inner join)
[
  { field: 'match_formats.format', operator: 'eq', value: '6x6' }
]
```

---

## Adding New Features (Checklist)

Screens other than the live match use the API layer only (direct Supabase). Only add RxDB/sync work when the feature is part of live match tracking and must work offline.

### 1. Database Schema
- [ ] Add table to Supabase (via migration in `supabase/migrations/`)
- [ ] Ensure `created_at`, `updated_at` and `_deleted` columns exist (and the `updated_at` trigger)
- [ ] Add RLS policies to Supabase table
- [ ] Regenerate [lib/supabase/database.types.ts](lib/supabase/database.types.ts) with `pnpm supabase:types`
- [ ] Update TypeScript types in [lib/types.ts](lib/types.ts)

### 2. API Layer
- [ ] Create `lib/api/<domain>/index.ts` exporting `createXApi(supabaseClient?)` that wraps `new SupabaseDataStore("<table>", supabaseClient)`
- [ ] Add custom methods if needed (beyond CRUD)
- [ ] Add to `createApi` in [lib/api/index.ts](lib/api/index.ts)
- [ ] Create custom hook `hooks/use-<domain>-api.ts` returning `getApi().<domain>`

### 3. Offline Live Match Data (only if the live match needs it)
- [ ] Add RxDB schema in [lib/rxdb/schema.ts](lib/rxdb/schema.ts), the `CollectionName` union, and the collection in [lib/rxdb/database.ts](lib/rxdb/database.ts)
- [ ] Scope sync to a match: add the collection to `dynamicCollections` in [lib/rxdb/sync/manager.ts](lib/rxdb/sync/manager.ts) (filtered by `match_id`) and to the per-match sync state (`SyncStateDocument` in [lib/rxdb/sync/types.ts](lib/rxdb/sync/types.ts), `initMatchSyncState`); don't add a whole-table replication
- [ ] Write through a Command in [lib/commands/match-commands.ts](lib/commands/match-commands.ts) so it supports undo
- [ ] Test offline and reconnect sync

### 4. UI Components
- [ ] Create feature components in [components/[domain]/](components/)
- [ ] Use API via custom hooks
- [ ] Add loading states
- [ ] Add error handling with toasts
- [ ] Add translations to every locale in `messages/` (`pnpm i18n:check`)
- [ ] Add to navigation if needed

### 5. Testing Offline Functionality (live match)
```typescript
// Test checklist:
// 1. Open the live match online so syncMatch pulls it
// 2. Go offline (Chrome DevTools → Network → Offline)
// 3. Score points / record stats / undo
// 4. Verify data in RxDB (IndexedDB via DevTools)
// 5. Go online
// 6. Verify the rows reach Supabase
// Automated: tests/e2e/04-live-offline.spec.ts (pnpm test:e2e)
```

### 6. Performance Considerations
- [ ] Add indexes to RxDB schema for queried fields (live match collections)
- [ ] Use pagination for large lists
- [ ] Implement virtualization for long lists (react-window)
- [ ] Optimize images (use Next.js Image if online-only)
- [ ] Lazy load components if large bundle
