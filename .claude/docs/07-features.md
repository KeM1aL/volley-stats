# Key Features Documentation

## 1. Live Match Tracking (Core Feature)

**Location**: [app/matches/live/page.tsx](app/matches/live/page.tsx) (`/matches/live?id=<matchId>`)

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
- **Set start** ([components/sets/set-setup.tsx](components/sets/set-setup.tsx), logic in [lib/matches/set-lineup.ts](lib/matches/set-lineup.ts)): a picked player goes on court at once; the default position is copied into the role only when it is a field role (setter, opposite, outside hitter, middle hitter), so a libero played on court has no role. Each player appears once in the lineup with one role (changing a position drops the previous player's role). A player on court without a role gets a red role select and a red court position, and Start set is blocked with a message naming those positions. A player on court can't be chosen as libero.
- When the match can't be loaded (no `?team=`, not on the device, download not finished, its teams or format missing, a team that doesn't play it, any other error), the page returns to the match list with a destructive toast that says why (`LiveLoadError` reasons in [lib/matches/live-load-failure.ts](lib/matches/live-load-failure.ts), `matches.live.left.*`). Leaving through Cancel or Leave needs no toast.

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
// app/matches/live/page.tsx
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
- **Archive a team**: the teams list's Archive action sets `status = 'archived'` (`teamApi.archiveTeam`); teams are never hard-deleted. Archived teams show under the "Archived" status filter, are not offered in the new-match team picker, and are restored by setting the status back to Active in the team dialog. Their matches stay where they are.
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

**Delete or archive a match** (matches list, [components/matches/history/match-removal-action.tsx](components/matches/history/match-removal-action.tsx)): an `upcoming` match is deleted for real (`matchApi.deleteUnstartedMatch`, RPC `delete_unstarted_match`, no restore); a `live` or `completed` match is archived (`matchApi.archiveMatch` sets `matches.archived_at`) and can be restored (`restoreMatch`). The rule is `matchRemoval` in [lib/matches/removal.ts](lib/matches/removal.ts), errors map through `removalError`. Only the creator of either team may do it (`canRemoveMatch`). It is refused while this device has unsent changes for the match. An archived match disappears from the matches list, team and championship views, team statistics and report access (`isMatchArchived`); the "Show archived (N)" toggle on the matches list shows them with a Restore action. The stats and score pages show an archived notice (with Restore for those allowed) instead of the data, and the live page leaves to the matches list with an "archived" toast. The deleting device calls `SyncManager.forgetMatch` (see [04-offline-sync.md](04-offline-sync.md)).

**Location**: [app/matches/stats/](app/matches/stats/) (`/matches/stats?id=<matchId>`), [lib/stats/](lib/stats/)

**Features**:
- Individual player performance metrics
- Team performance analysis
- MVP calculation (`mvp()` / `mvpScores()` in [lib/report/metrics/mvp.ts](lib/report/metrics/mvp.ts))
- Set-by-set breakdown
- Tactical insights, scoring patterns and streaks ([lib/stats/calculations.ts](lib/stats/calculations.ts))
- Visual charts (recharts):
  - Serve success rate
  - Attack efficiency
  - Block effectiveness
  - Reception quality
- **PDF report** (server-side, see below)

**Statistics Calculated**:
- Serve: Total, success rate, errors
- Spike/Attack: Total, kills, errors, efficiency %
- Block: Total, successful blocks, touches
- Reception: Total, perfect, good, errors
- Defense: Total, successful, errors
- Points scored per player

**PDF Report**:
- Generated on the server by `GET /api/v1/matches/[id]/report?team=<teamId>&locale=<locale>` ([app/api/v1/matches/[id]/report/route.web.ts](app/api/v1/matches/[id]/report/route.web.ts), web target only; the pages call it with `apiFetch`) with `@react-pdf/renderer`
- Only for signed-in members of the analysed team, its creator, and owners/admins of its club ([lib/report/access.ts](lib/report/access.ts)); the route reads with the caller's session (anon key), never the service role; `/api/v1/` is exempt from the proxy's sign-in redirect so it answers 401
- Metrics are pure functions in [lib/report/metrics/](lib/report/metrics/) assembled by `buildMatchReport` ([lib/report/build.ts](lib/report/build.ts)); the stats screen's MVP uses the same `mvp()`
- Pages: summary, match detail, one per set (timeline with events and their impact). Text in `messages/<locale>/report.json`
- The stats page button is shown to the same users ([lib/report/can-export.ts](lib/report/can-export.ts)) and disabled offline, without rallies, or while the match has unsent changes
- Design: [docs/superpowers/specs/2026-10-09-pdf-report-design.md](docs/superpowers/specs/2026-10-09-pdf-report-design.md)

---

## 4. Championship Management

**Location**: [app/championships/](app/championships/)

**Features**:
- Create championships with:
  - Format: 2x2, 3x3, 4x4, 6x6
  - Age category: U10, U12, U14, U16, U18, U21, Senior
  - Gender: Female, Male, Mixed
  - Match format rules (sets to win, points per set, rotation)
- Import matches (and missing teams) for a championship from FFVB via `/api/import/ffvb` ([lib/importers/ffvb.ts](lib/importers/ffvb.ts)). Admin only (`profiles.role = 'admin'`): the championship page shows `FfvbImportButton` only on the web build for an admin, and the route checks the role with `requireAdmin` ([lib/server/admin.ts](lib/server/admin.ts)): 401 signed out, 403 for a non-admin.
- Assign teams to championships
- Track championship seasons
- View championship standings (future feature)

**Implementation Note**: Championships use UUID IDs, like every table. The volleyball format (2x2, 3x3, 4x4, 6x6) is defined in the associated match_format record, allowing different match formats to share the same volleyball format specification.

---

## Offline gate

Screens that load everything from Supabase (`requiresConnection` in [lib/routes.ts](lib/routes.ts): the match list `/matches`, `/teams`, `/teams/new`, `/teams/view`, `/teams/players`, `/championships`, `/championships/view`) would open empty offline: on the web when the page comes from the cache, and always in the static export / Capacitor app (no service worker). `OfflineGate` ([components/offline-gate.tsx](components/offline-gate.tsx), around the page in `app/layout.tsx`, inside `AuthGuard`) decides when such a screen opens: offline, it shows an in-app offline screen instead (`data-testid="offline-page"`, the texts of `public/offline.html`, `common.offline.*`) and does not mount the page; **Back to the live match** when the live page saved its URL (`volleystats:last-live-match` in `sessionStorage`), otherwise **Go back**; **Retry** re-reads `navigator.onLine` and, if it still says offline, probes Supabase (`/auth/v1/health`, 5 s): some Android WebViews keep `navigator.onLine` false while online, and an answer opens the screen. When the connection comes back the page mounts and loads its data. A screen already open when the connection drops keeps what it shows. On the web, a screen the router doesn't hold yet can't be fetched offline: the navigation becomes a full page load and the service worker answers with `public/offline.html`, which reloads by itself on the `online` event. E2E: `tests/e2e/14-offline-gate.spec.ts`; for the static export it goes offline like the app (`goOfflineKeepingAppFiles`: the app's files still load), since `setOffline` would cut them too. The live match, stats, score, settings, home and auth screens are never gated.

## Language

One client-side path on both targets (`LocaleProvider`, [components/providers/locale-provider.tsx](components/providers/locale-provider.tsx); rules in [lib/i18n/resolve-locale.ts](lib/i18n/resolve-locale.ts)). The language is chosen after mount, first match wins:

1. `?lang=` in the URL (the proxy turns `/fr/matches` into `/matches?lang=fr`; the parameter is removed from the address bar afterwards). It counts as an explicit choice.
2. The language saved on the device (`localStorage`, key `volleystats:locale`).
3. The browser language (`navigator.languages`).
4. English.

The profile language is adopted once per user per device: on a signed-in user's first load on a device, if the choice was not explicit, the profile language replaces the current one and the user id is stored (`volleystats:locale-user`). After that the device's choice wins. An explicit `?lang=` also writes the mark as soon as the session user is known, so a reload right after sign-in keeps it. Changing the language (`useAppLocale().setLocale`) writes the device and, when signed in, the profile. Accepted cost: the web's first HTML is untranslated (a spinner), and crawlers see the landing page in English. Static `public/offline.html` reads the same `localStorage` key.

---

## Account deletion

Settings, "Delete account" card (both targets). For each team the user created, they choose to hand it over to a member who has an account or to delete it, confirm by typing their email, and the RPC `delete_my_account(decisions)` removes the account. Blocked while live-match changes are still unsent. When only changes the server refused are left (rejected: they will never upload), the card says how many and offers **Discard them**: after a confirmation, `SyncManager.discardRejected()` drops them and the device shows the server's version of those rows (see [04-offline-sync.md](04-offline-sync.md#push-rules)); pending changes are never discarded. Details: [06-auth.md](06-auth.md#account-deletion).
