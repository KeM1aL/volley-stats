# Key Features Documentation

## 1. Live Match Tracking (Core Feature)

**Location**: [app/matches/[id]/live/page.tsx](app/matches/[id]/live/page.tsx)

**Purpose**: Real-time point-by-point match scoring with comprehensive statistics tracking. This is the most critical feature of the application and must work offline. It is the only screen that reads and writes RxDB; see [04-offline-sync.md](04-offline-sync.md).

**Features**:
- Point-by-point scoring with instant feedback
- Automatic rotation tracking (for 6x6 volleyball)
- Player attribution for each action
- Stat tracking: serves, spikes, blocks, receptions, defenses
- Outcome recording: success, error, good, bad
- Player substitution management (stored as `substitution` events)
- Set progression
- **Undo/Redo functionality** (last 50 actions)
- Visual court positions
- Live score updates
- Works offline once the match has been pulled with `syncMatch(matchId)`

**Data Flow**:
```
Page load
  → db.syncManager.syncMatch(matchId) pulls the match into RxDB (30 s timeout)
User taps "Point" button
  → ScorePointCommand created
  → history.executeCommand(command)
  → Command writes score point / set / match to RxDB
  → Returned MatchState stored with setMatchState
  → SyncManager replication pushes to Supabase (when online)
  → Undo button enabled
```

**Implementation Pattern**:
```typescript
// app/matches/[id]/live/page.tsx
const { localDb: db } = useLocalDb()
const [matchState, setMatchState] = useState<MatchState>(initialMatchState)

// Command history for undo/redo
const { history, canUndo, canRedo } = useCommandHistory()

// Score a point
const command = new ScorePointCommand(matchState, point, myTeam, db)
const newMatchState = await history.executeCommand(command)
setMatchState(newMatchState)

// Undo last action
const handleUndo = async () => {
  const state = await history.undo()
  setMatchState(state)
}
```

**Critical Considerations**:
- All match data written locally first (RxDB)
- No direct network calls during live tracking; replication runs in the background
- User never blocked by network issues
- Replication conflicts resolve to the server state (RxDB default conflict handler)

---

## 2. Team & Player Management

**Location**: [app/teams/](app/teams/)

**Features**:
- Create and manage volleyball teams
- Add players with:
  - Name, number, position
  - Avatar upload (stored in Supabase Storage)
  - Role (player, coach, staff, owner)
- Assign teams to clubs and championships
- Team status: incomplete, active, archived
- Teams can also be created by the FFVB match import ([lib/importers/ffvb.ts](lib/importers/ffvb.ts))

**API Usage** (direct Supabase via the API layer):
```typescript
const teamApi = useTeamApi()
const teamMemberApi = useTeamMembersApi()

// Create team
const team = await teamApi.createTeam({
  name: 'Team Volley',
  club_id: clubId,
  championship_id: championshipId
})

// Add player
const player = await teamMemberApi.createTeamMember({
  team_id: team.id,
  name: 'John Doe',
  number: 7,
  role: 'player',
  position: 'outside_hitter'
})

// List teams with joined relations
const teams = await teamApi.getTeams(
  [{ field: 'club_id', operator: 'eq', value: clubId }],
  undefined,
  ['championships', 'clubs']
)
```

---

## 3. Statistics & Analytics

**Location**: [app/matches/[id]/stats/](app/matches/[id]/stats/), [lib/stats/](lib/stats/)

**Features**:
- Individual player performance metrics
- Team performance analysis
- MVP calculation (`calculateMVPScore` in [lib/stats/calculations.ts](lib/stats/calculations.ts))
- Set-by-set breakdown
- Tactical insights, scoring patterns and streaks ([lib/stats/calculations.ts](lib/stats/calculations.ts))
- Visual charts (recharts):
  - Serve success rate
  - Attack efficiency
  - Block effectiveness
  - Reception quality
- **PDF Export** (jsPDF + html2canvas)

**Statistics Calculated**:
- Serve: Total, success rate, errors
- Spike/Attack: Total, kills, errors, efficiency %
- Block: Total, successful blocks, touches
- Reception: Total, perfect, good, errors
- Defense: Total, successful, errors
- Points scored per player

**PDF Export**:
- Triggered from [app/matches/[id]/stats/page.tsx](app/matches/[id]/stats/page.tsx), which dynamically imports `jspdf` and builds the document
- Each exported tab component (`components/matches/stats/*`) exposes a `PdfExportHandle` ([lib/pdf/types.ts](lib/pdf/types.ts)) via `useImperativeHandle`; its `generatePdfContent(doc, yOffset, sets, title)` renders its section (capturing DOM with `html2canvas`) and returns the next y offset

---

## 4. Championship Management

**Location**: [app/championships/](app/championships/)

**Features**:
- Create championships with:
  - Format: 2x2, 3x3, 4x4, 6x6
  - Age category: U10, U12, U14, U16, U18, U21, Senior
  - Gender: Female, Male, Mixed
  - Match format rules (sets to win, points per set, rotation)
- Import matches (and missing teams) for a championship from FFVB via `/api/import/ffvb` ([lib/importers/ffvb.ts](lib/importers/ffvb.ts))
- Assign teams to championships
- Track championship seasons
- View championship standings (future feature)

**Implementation Note**: Championships use UUID IDs, like every table. The volleyball format (2x2, 3x3, 4x4, 6x6) is defined in the associated match_format record, allowing different match formats to share the same volleyball format specification.
