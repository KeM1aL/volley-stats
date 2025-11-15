# LiveMatch UI/UX Refactor - Implementation Summary

## Overview
Comprehensive refactoring of the LiveMatch page to add a collapsible sidebar with dynamic panels and unified events system, with complete migration of substitutions to the events table.

## Completed Work

### 1. Database Layer

#### Migration File
**File:** `supabase/migrations/20251114110505_enhance_events_and_migrate_substitutions.sql`
- Enhanced events table schema to support comprehensive event tracking
- Added new columns: `event_type`, `timestamp`, `team`, `player_id`, `details` (JSONB)
- Migrated all existing substitutions to events table with backward compatibility
- Created indexes for efficient querying (event_type, match_id+timestamp, etc.)
- Added helper function `get_substitution_events()` for easy retrieval
- Maintains original substitutions table for backward compatibility

#### RxDB Schema Updates
**File:** `lib/rxdb/schema.ts`
- Updated `eventSchema` to version 1 with enhanced structure
- Added proper indexes for efficient offline queries
- Support for nullable fields (set_id, team_id, player_id)
- JSONB details field for flexible event-specific data

### 2. Type Definitions

#### Comprehensive Event Types
**File:** `lib/types/events.ts` (New, ~300 lines)
- Base `MatchEvent` interface
- Six event types: substitution, timeout, injury, sanction, technical, comment
- Detailed interfaces for each event type with specific fields
- Type guards for runtime type checking
- Constants for UI display (icons, colors, labels)

**File:** `lib/types.ts` (Updated)
- Updated `Event` type to match new schema

### 3. API Layer

#### Event API
**File:** `lib/api/events/index.ts` (New, ~270 lines)
- Complete CRUD operations for events
- Helper methods for each event type (createSubstitution, createTimeout, etc.)
- Advanced filtering with `getFilteredEvents()`
- Compatibility method `getSubstitutions()` for migration

**File:** `lib/api/index.ts` (Updated)
- Added events API to main API factory

#### Hook
**File:** `hooks/use-event-api.ts` (New)
- Simple hook wrapper for EventApi

### 4. UI Components

#### Panel Components (3 new files)

**File:** `components/matches/live/panels/player-performance-panel.tsx`
- Compact player stats display optimized for 1/3 width
- Real-time efficiency calculations
- Color-coded performance indicators
- Scrollable list with player cards

**File:** `components/matches/live/panels/events-panel.tsx`
- Chronological event timeline
- Filter by event type dropdown
- Create new events with dialog
- Detailed event rendering for each type
- Real-time updates

**File:** `components/matches/live/panels/court-diagram-panel.tsx`
- Interactive court position diagram
- Current lineup display
- Server position indicator
- Rotation control
- Player legend

#### Form Component

**File:** `components/matches/live/events/event-form.tsx` (New, ~550 lines)
- Dynamic form with type-specific fields
- Six event types supported
- Full validation with Zod schemas
- Player selection dropdowns
- Checkbox controls for boolean fields
- Text areas for descriptions

#### Sidebar Component

**File:** `components/matches/live/live-match-sidebar.tsx` (New)
- Uses Shadcn sidebar infrastructure
- Four navigation items:
  1. Toggle (show/hide panel)
  2. Stats (player performance)
  3. Events (event timeline)
  4. Court (court diagram)
- Collapsible with icon-only or icon+text modes
- Active state highlighting

### 5. Page Layout

#### LiveMatch Page Restructure
**File:** `app/matches/[id]/live/page.tsx` (Major refactor)
- Wrapped with `SidebarProvider`
- New layout structure:
  - Left: Collapsible sidebar
  - Middle: Dynamic 1/3 panel (conditional)
  - Right: 2/3 content (StatTracker or SetSetup)
- State management for panel visibility and active panel
- Responsive grid that adapts when panel is hidden
- Sticky header that stays at top
- Full-height layout with proper overflow handling

### 6. Command Pattern Updates

#### SubstitutionCommand
**File:** `lib/commands/match-commands.ts` (Updated)
- Dual-write approach: writes to both substitutions AND events tables
- Creates event record with proper details structure
- Undo removes both records
- Maintains backward compatibility

### 7. Sync Configuration

**Status:** ✅ Already configured
- Events collection already included in sync collections map
- Located in `components/providers/local-database-provider.tsx` (line 36)
- SyncHandler automatically handles events with all sync features:
  - Initial sync
  - Real-time updates
  - Offline queue
  - Conflict resolution (LWW)

## Architecture Benefits

### Scalability
- Event system can be extended with new event types without schema changes
- JSONB details field allows flexible event-specific data
- Panel system can accommodate new panels easily

### Offline-First
- All events sync via RxDB
- Substitutions work offline (dual-write)
- Queue system handles connectivity issues

### Backward Compatibility
- Substitutions table preserved
- Dual-write ensures old queries still work
- Migration is non-destructive
- Rollback possible via substitution_id reference

### Developer Experience
- Type-safe event creation
- Consistent API patterns
- Reusable panel components
- Clear separation of concerns

## File Summary

### New Files (10)
1. `supabase/migrations/20251114110505_enhance_events_and_migrate_substitutions.sql`
2. `lib/types/events.ts`
3. `lib/api/events/index.ts`
4. `hooks/use-event-api.ts`
5. `components/matches/live/events/event-form.tsx`
6. `components/matches/live/panels/player-performance-panel.tsx`
7. `components/matches/live/panels/events-panel.tsx`
8. `components/matches/live/panels/court-diagram-panel.tsx`
9. `components/matches/live/live-match-sidebar.tsx`
10. `IMPLEMENTATION_SUMMARY.md`

### Modified Files (5)
1. `lib/rxdb/schema.ts` - Enhanced events schema
2. `lib/types.ts` - Updated Event type
3. `lib/api/index.ts` - Added events API
4. `lib/commands/match-commands.ts` - Dual-write for substitutions
5. `app/matches/[id]/live/page.tsx` - Complete layout refactor

### Removed Imports (2)
- `ScoreBoard` - No longer used in main layout
- `PlayerPerformance` - Replaced by PlayerPerformancePanel

## Next Steps

### Required: Database Migration
```bash
# Run the migration to update the database
npx supabase migration up

# Or if using CLI directly
psql -h <host> -U <user> -d <database> -f supabase/migrations/20251114110505_enhance_events_and_migrate_substitutions.sql
```

### Testing Checklist

#### Desktop Layout
- [ ] Sidebar expands/collapses correctly
- [ ] Panel toggle shows/hides 1/3 section
- [ ] Clicking active panel toggles it off
- [ ] StatTracker expands to full width when panel is hidden
- [ ] All three panels render correctly (Stats, Events, Court)
- [ ] Panel switching is smooth without layout jumps

#### Events System
- [ ] Can create all six event types
- [ ] Event filtering works correctly
- [ ] Event timeline displays chronologically
- [ ] Event details render properly for each type
- [ ] Real-time event updates work
- [ ] Events persist offline

#### Substitution Migration
- [ ] Existing substitutions appear in events panel
- [ ] New substitutions create both records (dual-write)
- [ ] Undo works for new substitutions
- [ ] No data loss during migration
- [ ] Substitution details display correctly

#### Mobile (Future)
- [ ] Sidebar becomes bottom drawer
- [ ] Content toggles between StatTracker and panels
- [ ] Full-width layout on small screens
- [ ] Touch interactions work properly

#### Offline Functionality
- [ ] Events can be created offline
- [ ] Events sync when online
- [ ] No data loss when going offline mid-match
- [ ] Sync status indicators work

## Known Issues / Future Enhancements

### High Priority
1. Mobile layout not yet implemented (desktop-first approach)
2. Need to test with real match data
3. May need to adjust panel widths for different screen sizes

### Medium Priority
4. Add event editing functionality
5. Add event deletion with confirmation
6. Implement event search/advanced filtering
7. Add event export to match reports

### Low Priority
8. Add event templates for common scenarios
9. Add event attachments (photos, videos)
10. Add event analytics and insights

## Mobile Implementation Plan (Future)

When ready to implement mobile layout:

1. **Use Shadcn Sheet component for bottom drawer**
   - Replace Sidebar with Sheet on mobile
   - Swipe-up gesture to open drawer
   - Tabbed interface for panel switching

2. **Full-width content toggle**
   - Button to switch between StatTracker and panel views
   - Smooth transitions between views
   - Preserve state when switching

3. **Touch-optimized controls**
   - Larger tap targets
   - Swipe gestures for navigation
   - Bottom navigation bar

## Performance Considerations

- ✅ RxDB indexes optimize event queries
- ✅ React.memo used in panel components
- ✅ Virtualization not needed yet (limited data per match)
- ⚠️ Consider pagination if event history becomes very large
- ⚠️ Monitor bundle size with new components (~2KB added)

## Documentation Updates Needed

1. Update [07-features.md](/.claude/docs/07-features.md) with events system
2. Update [03-code-patterns.md](/.claude/docs/03-code-patterns.md) with panel pattern
3. Update [04-offline-sync.md](/.claude/docs/04-offline-sync.md) with events sync
4. Update [05-database-schema.md](/.claude/docs/05-database-schema.md) with enhanced events table

## Conclusion

This refactoring significantly improves the LiveMatch UX by:
- **Better organization**: Sidebar navigation is intuitive and accessible
- **More information**: Three panels provide rich context without cluttering main view
- **Extensibility**: Event system can grow to support many event types
- **Maintainability**: Clean separation between panels and main content
- **Performance**: Offline-first with efficient sync

The implementation is production-ready pending:
1. Database migration execution
2. Comprehensive testing
3. Mobile layout implementation

**Estimated Testing Time**: 2-3 hours for thorough testing of all functionality
**Estimated Mobile Implementation**: 4-6 hours

---

**Implementation Date**: November 14, 2025
**Lines of Code Added**: ~2,500
**Lines of Code Modified**: ~500
**Files Created**: 10
**Files Modified**: 5
