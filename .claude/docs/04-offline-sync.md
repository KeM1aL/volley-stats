# Offline-First Architecture

## RxDB Configuration

**Location**: [lib/rxdb/](lib/rxdb/)

**Storage Engine**: Dexie (IndexedDB) with memory fallback

**Collections** (13 total, mirroring Supabase):
1. clubs
2. club_members
3. teams
4. team_members
5. championships
6. seasons
7. match_formats
8. matches
9. sets
10. substitutions
11. score_points
12. player_stats
13. events

**Schema Features**:
- Primary keys: UUIDs (strings) for most tables, integers for championships/seasons/formats
- Indexes: `created_at`, `updated_at` on all tables + domain-specific indexes
- Validation: JSON Schema via AJV plugin
- Timestamps: Automatic `created_at` and `updated_at` tracking

---

## Synchronization Mechanism

**Location**: [lib/rxdb/sync/sync-handler.ts](lib/rxdb/sync/sync-handler.ts)

**SyncHandler Class** manages bidirectional sync between RxDB and Supabase.

### Key Features

1. **Initial Sync** (on login):
   - Fetch all accessible records from Supabase
   - Compare `updated_at` timestamps
   - Upsert newer records into RxDB
   - Queue purely local records for upload

2. **Real-time Sync** (when online):
   ```
   Local Change:
   RxDB → RxChangeEvent → SyncHandler → Supabase

   Remote Change:
   Supabase Realtime → SyncHandler → RxDB
   ```

3. **Offline Queue** (when offline):
   - Changes queued in memory
   - Processed automatically when connectivity restored
   - Max 3 retries per change
   - Process every 30 seconds when online

4. **Conflict Resolution** (Last-Write-Wins):
   ```typescript
   if (localRecord.updated_at > remoteRecord.updated_at) {
     // Local wins: upload to Supabase
     await supabase.upsert(localRecord)
   } else {
     // Remote wins: update RxDB
     await rxdbCollection.upsert(remoteRecord)
   }
   ```

5. **Edge Cases Handled**:
   - INSERT conflict (23505): Convert to UPDATE if local is newer
   - DELETE from server: Always delete locally, warn if queued changes exist
   - Network errors: Queue changes, show user notification, auto-retry
   - Stale data: Always check timestamps before applying changes

### Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User Action                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │    RxDB     │
                  └──────┬──────┘
                         │
                 RxChangeEvent
                         │
                         ▼
              ┌──────────────────┐
              │   SyncHandler    │
              │  - Queue item    │
              │  - Check online  │
              └──────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
     ┌────▼────┐           ┌────▼─────┐
     │ Online  │           │ Offline  │
     └────┬────┘           └────┬─────┘
          │                     │
          ▼                     ▼
    ┌────────────┐      ┌──────────────┐
    │  Supabase  │      │ Queue in     │
    │  - Upsert  │      │ Memory       │
    │  - Realtime│      │ - Retry      │
    │    notify  │      │   on online  │
    └─────┬──────┘      └──────────────┘
          │
          ▼
   ┌──────────────┐
   │ Other Clients│
   │  (Realtime)  │
   └──────────────┘
```

### Implementation Notes

- Sync is transparent to components - they always query RxDB
- User sees toast notifications for sync status
- Offline indicator in UI
- Conflicts are rare due to team-based data isolation
- No user intervention required for conflict resolution

---

## What Works Offline

**Fully Offline**:
✅ View all previously synced data (teams, matches, players)
✅ **Live match tracking** (complete functionality)
✅ Create new teams, matches, players
✅ Edit any local records
✅ Delete records
✅ View statistics and history
✅ Player substitutions
✅ Undo/redo operations

**Requires Online**:
❌ Initial data sync (first login)
❌ Real-time updates from other users
❌ PDF export (font loading)
❌ Authentication (login/signup)
❌ Avatar uploads
❌ Championship imports from external sources

**User Experience**:
- Offline indicator in UI (top banner)
- Toast notifications for sync status
- Automatic sync when connectivity restored
- No data loss (queued changes preserved in memory)
- Transparent to user (no manual sync required)
