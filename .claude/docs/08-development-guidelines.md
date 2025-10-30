# Development Guidelines

## Naming Conventions

### Files
- Components: PascalCase with descriptive names
  - `TeamTable.tsx`, `LiveMatchHeader.tsx`, `PlayerStatsCard.tsx`
- Hooks: camelCase with "use" prefix
  - `useTeamApi.ts`, `useLocalDatabase.ts`, `useCommandHistory.ts`
- Utilities: camelCase
  - `retry.ts`, `date-utils.ts`, `format.ts`
- APIs: camelCase files, API classes in PascalCase
  - `index.ts` exports `TeamApi`, `MatchApi`
- Types: Single `types.ts` file with PascalCase type names

### Variables & Functions
- React components: PascalCase (`LiveMatchTracker`, `TeamForm`)
- Functions: camelCase (`handleScorePoint`, `calculateMVP`)
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
try {
  await operation()
  toast({
    title: "Success",
    description: "Operation completed successfully"
  })
} catch (error) {
  console.error("Operation failed:", error)
  toast({
    variant: "destructive",
    title: "Error",
    description: error instanceof Error ? error.message : "An error occurred"
  })
}
```

### Strategies by Layer

1. **UI Layer**: Toast notifications (via sonner)
   - Success: Green toast with checkmark
   - Error: Red toast with error icon
   - Info: Blue toast for sync status

2. **API Layer**: Throw descriptive errors
   ```typescript
   if (!result) {
     throw new Error(`Team with ID ${id} not found`)
   }
   ```

3. **Sync Layer**: Automatic retry with backoff
   ```typescript
   // lib/rxdb/sync/sync-handler.ts
   async function syncWithRetry(item: SyncQueueItem) {
     const maxRetries = 3
     let attempt = 0

     while (attempt < maxRetries) {
       try {
         await syncToSupabase(item)
         return
       } catch (error) {
         attempt++
         await sleep(Math.pow(2, attempt) * 1000) // Exponential backoff
       }
     }

     // Failed after max retries
     addToFailedQueue(item)
   }
   ```

4. **Validation**: Zod schemas for forms
   ```typescript
   const teamFormSchema = z.object({
     name: z.string().min(1, "Name is required"),
     championship_id: z.number().optional(),
   })

   // In form component
   const form = useForm({
     resolver: zodResolver(teamFormSchema)
   })
   ```

5. **RxDB**: Schema validation via AJV
   - Automatic validation on insert/update
   - Prevents invalid data in local database

---

## API Layer Usage

### Getting API Instance
```typescript
// In components
const teamApi = useTeamApi()
const matchApi = useMatchApi()

// In server components or utilities
import { getApi } from '@/lib/api'
const api = getApi()
```

### CRUD Operations

```typescript
// Create
const team = await teamApi.create({
  name: 'New Team',
  club_id: clubId
})

// Read (single)
const team = await teamApi.get(teamId, {
  joins: ['team_members', 'clubs']  // Include relations
})

// Read (list) with filters
const teams = await teamApi.getAll({
  filters: {
    club_id: clubId,
    championship_id: { operator: 'in', value: [1, 2, 3] }
  },
  sort: { field: 'created_at', direction: 'desc' }
})

// Update
const updated = await teamApi.update(teamId, {
  name: 'Updated Name'
})

// Delete
await teamApi.delete(teamId)
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

### Complex Filters
```typescript
// AND condition
filters: {
  club_id: clubId,
  status: 'completed'
}

// OR condition
filters: {
  or: [
    { home_team_id: teamId },
    { away_team_id: teamId }
  ]
}
```

---

## Adding New Features (Offline-First Checklist)

When adding a new feature, follow this checklist to ensure offline compatibility:

### 1. Database Schema
- [ ] Add table to Supabase (via migration)
- [ ] Add corresponding RxDB schema in [lib/rxdb/schema.ts](lib/rxdb/schema.ts)
- [ ] Ensure `created_at` and `updated_at` fields exist
- [ ] Add RLS policies to Supabase table
- [ ] Update TypeScript types in [lib/types.ts](lib/types.ts)

### 2. API Layer
- [ ] Create API class in [lib/api/[domain]/](lib/api/)
- [ ] Extend `SupabaseDataStore` or use directly
- [ ] Add custom methods if needed (beyond CRUD)
- [ ] Add to API factory in [lib/api/index.ts](lib/api/index.ts)
- [ ] Create custom hook `use[Domain]Api.ts`

### 3. Sync Configuration
- [ ] Add collection to SyncHandler in [lib/rxdb/sync/sync-handler.ts](lib/rxdb/sync/sync-handler.ts)
- [ ] Configure Realtime subscription
- [ ] Test bidirectional sync
- [ ] Handle conflicts (LWW is default)

### 4. UI Components
- [ ] Create feature components in [components/[domain]/](components/)
- [ ] Use API via custom hooks
- [ ] Add loading states
- [ ] Add error handling with toasts
- [ ] Test offline behavior
- [ ] Add to navigation if needed

### 5. Testing Offline Functionality
```typescript
// Test checklist:
// 1. Go offline (Chrome DevTools → Network → Offline)
// 2. Create/edit/delete data
// 3. Verify data in RxDB (IndexedDB via DevTools)
// 4. Go online
// 5. Verify sync to Supabase
// 6. Check other client receives update via Realtime
// 7. Test conflict scenario (edit same record on two devices offline)
```

### 6. Performance Considerations
- [ ] Add indexes to RxDB schema for queried fields
- [ ] Use pagination for large lists
- [ ] Implement virtualization for long lists (react-window)
- [ ] Optimize images (use Next.js Image if online-only)
- [ ] Lazy load components if large bundle
