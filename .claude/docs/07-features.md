# Key Features Documentation

## 1. Live Match Tracking (Core Feature)

**Location**: [app/matches/[id]/live/page.tsx](app/matches/[id]/live/page.tsx)

**Purpose**: Real-time point-by-point match scoring with comprehensive statistics tracking. This is the most critical feature of the application and must work 100% offline.

**Features**:
- Point-by-point scoring with instant feedback
- Automatic rotation tracking (for 6x6 volleyball)
- Player attribution for each action
- Stat tracking: serves, spikes, blocks, receptions, defenses
- Outcome recording: success, error, good, bad
- Player substitution management
- Set progression
- **Undo/Redo functionality** (last 50 actions)
- Visual court positions
- Live score updates
- Works completely offline

**Data Flow**:
```
User taps "Point" button
  → ScorePointCommand created
  → Command executed
  → Updates local match state
  → Persists to RxDB
  → SyncHandler uploads to Supabase (when online)
  → UI reactively updates
  → Undo button enabled
```

**Implementation Pattern**:
```typescript
// Live match component uses reducer for complex state
const [matchState, dispatch] = useReducer(matchReducer, initialState)

// Command history for undo/redo
const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory()

// Score a point
const handleScorePoint = async (team: 'home' | 'away') => {
  const command = new ScorePointCommand(matchState, { team })
  const newState = await executeCommand(command)
  dispatch({ type: 'UPDATE_STATE', payload: newState })
}

// Undo last action
const handleUndo = async () => {
  const newState = await undo()
  dispatch({ type: 'UPDATE_STATE', payload: newState })
}
```

**Critical Considerations**:
- All data stored locally first (RxDB)
- No network calls during live tracking
- Background sync happens automatically
- User never blocked by network issues
- Conflicts resolved automatically (LWW)

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
- Import teams from CSV or external sources
- Team member invitation system

**API Usage**:
```typescript
const teamApi = useTeamApi()

// Create team
const team = await teamApi.create({
  name: 'Team Volley',
  club_id: clubId,
  championship_id: championshipId
})

// Add player
const player = await teamApi.addPlayer(teamId, {
  name: 'John Doe',
  number: 7,
  role: 'player',
  position: 'Outside Hitter'
})

// Get team with members
const teamWithMembers = await teamApi.get(teamId, {
  joins: ['team_members', 'clubs', 'championships']
})
```

---

## 3. Statistics & Analytics

**Location**: [app/matches/[id]/stats/](app/matches/[id]/stats/), [lib/stats/](lib/stats/)

**Features**:
- Individual player performance metrics
- Team performance analysis
- MVP calculation (based on weighted stats)
- Set-by-set breakdown
- Historical match data with filters
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
```typescript
// lib/pdf/match-stats-export.ts
export async function exportMatchStatsToPDF(matchId: string) {
  // 1. Query match data with all stats
  const matchData = await getMatchWithStats(matchId)

  // 2. Render stats component to hidden div
  const element = document.getElementById('stats-export-container')

  // 3. Use html2canvas to capture as image
  const canvas = await html2canvas(element)

  // 4. Generate PDF with jsPDF
  const pdf = new jsPDF('p', 'mm', 'a4')
  pdf.addImage(canvas, 'PNG', 0, 0, 210, 297)

  // 5. Download
  pdf.save(`match-stats-${matchId}.pdf`)
}
```

---

## 4. Championship Management

**Location**: [app/championships/](app/championships/)

**Features**:
- Create championships with:
  - Format: 2x2, 3x3, 4x4, 6x6
  - Age category: U10, U12, U14, U16, U18, U21, Senior
  - Gender: Female, Male, Mixed
  - Match format rules (sets to win, points per set, rotation)
- Import championships from external sources
- Assign teams to championships
- Track championship seasons
- View championship standings (future feature)

**Implementation Note**: Championships use UUID IDs. The volleyball format (2x2, 3x3, 4x4, 6x6) is defined in the associated match_format record, allowing different match formats to share the same volleyball format specification.
