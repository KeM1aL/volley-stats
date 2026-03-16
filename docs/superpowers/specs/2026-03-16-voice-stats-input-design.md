# Voice Stats Input — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Feature:** Optional offline voice input for live match stat tracking

---

## Problem

During live match tracking, recording a stat requires three taps: select player → select action → select result. This is too slow during fast rallies, particularly for solo operators tracking their own team. A hands-free voice alternative is needed.

## Goals

- Let the user narrate actions naturally ("Marie spike good", "bonne attaque de François")
- Work offline where the platform permits (see constraint below)
- Support flexible sentence structure and multiple languages
- Show a validation queue before committing any data
- Remain entirely optional — existing tap UI unchanged

## Offline Constraint

**Web Speech API does not work offline on Android/Chrome** — audio is sent to Google's servers. It works offline on:
- macOS/Windows Chrome/Edge (cached speech model after first use)
- iOS Safari (on-device, no network needed)

On Android Chrome without network, voice input is gracefully disabled: the mic button shows a "no network" state and a toast explains why. The tap UI remains fully functional. This is documented to the user in the Voice settings tab.

**Future mobile app (Capacitor):** uses the native platform STT API (fully offline on both iOS and Android) — only the `useSpeechRecognition` hook changes.

## Non-Goals

- Replacing the tap UI
- On-device LLM (full language model) — lightweight fuzzy matching is sufficient
- Auto-detection of speech start/end — hold-to-talk is intentional
- Real-time transcription display

---

## Architecture

### Speech Pipeline

```
[Hold mic button]
    → Web Speech API (locale from user settings, switchable per match)
      OR  "unavailable" state if offline on unsupported platform
    → Raw transcript: "bonne attaque de François"
    → VoiceParser:
        1. Tokenize (lowercase, strip punctuation)
        2. Generate n-grams (1..3 tokens)
        3. Match each n-gram, in priority order: player → action → result
             - player: name + voice_aliases (fuzzy, team-scoped)
             - action: synonyms in voice_vocabulary (language + '*', exact then fuzzy)
             - result: synonyms in voice_vocabulary (multi-word phrases supported)
             - stop words: skip
           Longest match wins; once a slot is filled, later n-grams skip that slot.
           If same token scores above threshold for multiple categories, priority applies.
        4. Unmatched tokens → stored for synonym review
    → PendingVoiceAction: {
        player: TeamMember | null,   // full TeamMember object from playerById map
        statType: StatType | null,
        result: StatResult | null,
        confidence: number,
        rawTokens: string[],
        unmatched: string[]
      }
    → Appended to rally queue
```

**Word order is not fixed.** All of these resolve to the same action:
- "good spike Marie"
- "Marie spike good"
- "bonne attaque de François"
- "attaque dans le filet de Jo"  → Jo / SPIKE / ERROR (multi-word synonym)

**N-gram priority:** player > action > result. If a token matches both action and result, action wins. This prevents ambiguity (e.g. "ace" defaults to result:SUCCESS unless overridden; if user adds "ace" as an action synonym it takes player priority).

### Rally Lifecycle

```
Hold mic × N utterances    →  rally queue grows
  - GOOD / BAD results accumulate silently (player stat, no point)
  - SUCCESS / ERROR result detected in transcript
    OR manual score button pressed
    →  VoiceValidationDrawer opens
    →  5-second countdown with animated progress bar
    →  Auto-confirms on timeout
    →  User can edit any field via inline tag picker, delete a line, or Discard All
    →  On confirm: calls existing onStat() + onPoint() for each action
```

**GOOD / BAD stats** accumulate in the queue without opening the drawer. The drawer only triggers when the rally ends (point-ending result OR manual score button). This allows uninterrupted rally narration.

### Props passed to VoiceValidationDrawer

The drawer receives the same match context as `StatTracker` to resolve position and build valid `PlayerStat`/`ScorePoint` objects:

```typescript
type VoiceValidationDrawerProps = {
  match: Match
  managedTeam: Team
  opponentTeam: Team
  currentSet: Set
  score: Score
  playerById: Map<string, TeamMember>
  pendingActions: PendingVoiceAction[]
  onConfirm: (actions: PendingVoiceAction[]) => Promise<void>
  onDiscard: () => void
}
```

**Position resolution** (mirrors `stat-tracker.tsx` lines 143–149):
```typescript
// Inside onConfirm, for each action:
const position = liberoPlayer?.id === action.player.id
  ? null
  : (Object.entries(currentSet.current_lineup)
      .find(([, id]) => id === action.player.id)?.[0] as PlayerPosition ?? null)
// position is null for libero, null for players not in current_lineup (substituted out).
// A substituted-out player's voice stat is still saved — with position: null — same as libero.
```

**ScorePoint construction during onConfirm:**

Voice input tracks only the managed team (`action_team_id` is always `managedTeam.id`). The drawer calls `onStat` for every confirmed action, and `onPoint` only for actions with `result === SUCCESS || result === ERROR`. Points in a batch are processed sequentially; each SUCCESS/ERROR action increments the running score used to compute `point_number`:

```typescript
// StatType → PointType mapping
const statTypeToPointType: Record<StatType, PointType> = {
  [StatType.SERVE]:     PointType.SERVE,
  [StatType.SPIKE]:     PointType.SPIKE,
  [StatType.BLOCK]:     PointType.BLOCK,
  [StatType.RECEPTION]: PointType.RECEPTION,
  [StatType.DEFENSE]:   PointType.DEFENSE,
}

let runningScore = { home: score.home, away: score.away }
for (const action of confirmedActions) {
  // Build and save PlayerStat (all confirmed actions)
  const playerStat: PlayerStat = {
    id: crypto.randomUUID(),
    match_id: match.id, set_id: currentSet.id,
    player_id: action.player.id, team_id: managedTeam.id,
    position, stat_type: action.statType, result: action.result,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  await onStat(playerStat)

  // Build and save ScorePoint only for point-ending results
  if (action.result === StatResult.SUCCESS || action.result === StatResult.ERROR) {
    const isSuccess = action.result === StatResult.SUCCESS
    const scoringTeamId = isSuccess ? managedTeam.id : opponentTeam.id
    runningScore = {
      home: scoringTeamId === match.home_team_id ? runningScore.home + 1 : runningScore.home,
      away: scoringTeamId === match.away_team_id ? runningScore.away + 1 : runningScore.away,
    }
    const point: ScorePoint = {
      id: crypto.randomUUID(),
      match_id: match.id, set_id: currentSet.id,
      point_number: runningScore.home + runningScore.away,
      scoring_team_id: scoringTeamId,
      action_team_id: managedTeam.id,               // always managed team
      point_type: statTypeToPointType[action.statType] ?? PointType.UNKNOWN,
      player_id: action.player?.id ?? null,
      player_stat_id: playerStat.id,                // link to the stat saved above
      result: isSuccess ? StatResult.SUCCESS : StatResult.ERROR,
      home_score: runningScore.home, away_score: runningScore.away,
      current_rotation: currentSet.current_lineup,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    await onPoint(point)
  }
}
```

### Fuzzy Matching Algorithm

```typescript
// Match a single token against candidates
matchToken(token: string, candidates: string[]): { match: string, score: number }
  // 1. Exact match → score 1.0
  // 2. Starts-with → score 0.9
  // 3. Levenshtein distance ≤ 2 for strings ≥ 4 chars → score 0.7–0.8
  // 4. No match → score 0

// Parse full transcript
parseTranscript(transcript, vocabulary, players): ParseResult
  tokens  = tokenize(transcript)
  ngrams  = generateNgrams(tokens, maxLen=3)   // longest first
  results: PendingVoiceAction = { player: null, statType: null, result: null, ... }

  for ngram in ngrams (longest first):
    if results.player === null → try players (name + aliases); assign if matched
    if results.statType === null → try action synonyms (language + '*'); assign if matched
    if results.result === null → try result synonyms; assign if matched
    if no match in any open slot → push ngram.tokens to unmatched

  return { ...results, confidence: avg(matchedScores), unmatched }
```

### isRecording guard

The mic button is disabled when `isRecording === true` (stat is being saved). Voice commits in `onConfirm` set `isRecording = true` for the duration of all `onStat`/`onPoint` calls. This prevents simultaneous tap and voice submissions.

---

## UI

### MicButton

- Placed in StatTracker bottom row, **half width**, sharing the row with the Undo button (equal split: `grid-cols-2`)
- **Hold-to-talk**: `pointerdown` → start; `pointerup`/`pointercancel` → stop and process
- Visual states: idle (blue), recording (pulsing ring + red dot), processing (spinner), unavailable (grey, tooltip "Voice requires network on this device")
- `disabled` when `isRecording === true`
- Language pill beside button — tap to cycle locale or open quick picker

### VoiceValidationDrawer

Opens as a bottom Sheet (`shadcn/ui` `<Sheet side="bottom">`) after a rally point is committed.

```
┌─ Rally Actions ──────────────── Auto-confirm in 5s ─┐
│ ████████████████░░░░░░░░░░░░░░░░  (progress bar)      │
│                                                       │
│  [Marie #4] [SERVE] [SUCCESS ★]                  🗑   │
│                                                       │
│  ⚠ Player not recognized                             │
│  [? "Julien"] [BLOCK] [GOOD ↑]                   🗑   │
│  ┌─ SELECT PLAYER ──────────────────────────────┐    │
│  │  Marie #4  │ [Jules #11 ✓] │ Sophie #7 │ ... │    │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  [Sophie #7] [DEFENSE] [BAD ↓]                   🗑   │
│                                                       │
│  [ Discard All ]          [ ✓ Confirm All ]          │
└───────────────────────────────────────────────────────┘
```

- **Tapping a tag** (player/action/result) opens an inline alternative picker below that row
- No pencil icon — tags are directly tappable
- Unknown fields: red border + warning text
- **Countdown pauses** while a picker is open (prevents accidental auto-confirm during editing)
- Trash icon (🗑) at end of each line to remove that action
- **5-second** auto-confirm countdown (consistent throughout)

---

## Data Model

### New table: `voice_vocabulary`

```sql
CREATE TABLE voice_vocabulary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       TEXT NOT NULL CHECK (scope IN ('admin', 'team')),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  language    TEXT NOT NULL DEFAULT '*',   -- 'en', 'fr', 'es', 'it', 'pt', '*'
  term_type   TEXT NOT NULL CHECK (term_type IN ('action', 'result', 'stop_word')),
  canonical   TEXT NOT NULL,
  synonyms    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT canonical_valid CHECK (
    (term_type = 'action'    AND canonical IN ('serve','spike','block','reception','defense'))
    OR (term_type = 'result' AND canonical IN ('success','error','good','bad'))
    OR (term_type = 'stop_word')
  )
);
-- RLS:
--   SELECT: authenticated users where scope='admin' OR team_id IN (user's teams)
--   INSERT/UPDATE/DELETE: team owners/admins for scope='team' rows; app admin role for scope='admin'
```

### New table: `voice_unmatched_phrases`

Stores unrecognized transcript fragments for later synonym review. **Local-only** (RxDB only, not synced to Supabase).

```typescript
// RxDB collection schema only — no Supabase mirror
voice_unmatched_phrases: {
  id: string
  team_id: string
  match_id: string
  phrase: string        // the unrecognized token(s)
  transcript: string    // full original transcript for context
  collected_at: string  // ISO timestamp
}
```

### Modified table: `team_members`

```sql
ALTER TABLE team_members ADD COLUMN voice_aliases TEXT[] DEFAULT '{}';
```

### RxDB sync strategy

| Collection | Sync direction | Notes |
|---|---|---|
| `voice_vocabulary` | Supabase → RxDB (pull only on app load / team load) | Team edits go directly to Supabase via API, then pulled to RxDB. **Editing is disabled when offline** — the Voice settings tab shows an "offline — changes unavailable" notice. |
| `voice_unmatched_phrases` | Local only (no Supabase mirror) | Cleared after user reviews and assigns synonyms |
| `team_members` | Existing bidirectional sync | `voice_aliases` field included in existing sync |

### Admin seed data (sample)

| language | term_type | canonical | synonyms |
|----------|-----------|-----------|----------|
| en | action | serve | ["serve","service"] |
| en | action | spike | ["spike","attack","kill","smash"] |
| en | action | block | ["block"] |
| en | action | reception | ["reception","receive","pass"] |
| en | action | defense | ["defense","dig"] |
| en | result | success | ["success","ace","winner","point","perfect"] |
| en | result | error | ["error","fault","missed","out","net"] |
| en | result | good | ["good","nice","well","great"] |
| en | result | bad | ["bad","poor","weak"] |
| fr | action | serve | ["service","serv"] |
| fr | action | spike | ["attaque","smash","frappe"] |
| fr | action | block | ["contre","bloc","block"] |
| fr | action | reception | ["réception","passe","manchette"] |
| fr | action | defense | ["défense","dig"] |
| fr | result | success | ["ace","parfait","winner","gagnant"] |
| fr | result | error | ["faute","erreur","dans le filet","au filet","hors","dehors"] |
| fr | result | good | ["bien","bonne","beau","belle","super"] |
| fr | result | bad | ["mauvais","mauvaise","raté","ratée"] |
| * | stop_word | — | ["de","du","le","la","les","un","une","the","a","an","by","from","of"] |

---

## i18n

New namespace: `messages/{locale}/voice.json` (all 5 locales: en, fr, es, it, pt)

Key structure:
```json
{
  "mic": {
    "holdToSpeak": "Hold to speak",
    "recording": "Recording…",
    "processing": "Processing…",
    "unavailable": "Voice requires network on this device",
    "language": "Voice language"
  },
  "drawer": {
    "title": "Rally Actions",
    "autoConfirm": "Auto-confirm in {{seconds}}s",
    "confirmAll": "Confirm All",
    "discardAll": "Discard All",
    "unknownPlayer": "Player not recognized — tap to fix",
    "unknownAction": "Action not recognized — tap to fix",
    "unknownResult": "Result not recognized — tap to fix",
    "selectPlayer": "Select player",
    "selectAction": "Select action",
    "selectResult": "Select result"
  },
  "vocabulary": {
    "title": "Voice Settings",
    "playerAliases": "Player aliases",
    "addAlias": "Add alias",
    "actionSynonyms": "Action synonyms",
    "resultSynonyms": "Result synonyms",
    "unmatchedTitle": "Unrecognized phrases",
    "unmatchedEmpty": "No unrecognized phrases",
    "assignTo": "Assign to",
    "offlineNote": "Voice input requires network on Android/Chrome",
    "offlineVocabularyNote": "Offline — vocabulary changes unavailable"
  }
}
```

---

## Vocabulary Management

### Team voice settings — new "Voice" tab on team detail page (`app/teams/[id]/page.tsx`)

- Per-player alias management: add/remove voice aliases on each TeamMember card
- Team action synonym overrides: add synonyms for any canonical action/result
- Link to unmatched phrase review
- Offline note explaining Android/Chrome limitation

### Unmatched phrase review (`app/teams/[id]/voice/page.tsx`)

- Lists all unrecognized phrases from `voice_unmatched_phrases` RxDB collection
- For each phrase: shows full transcript context, assign to player / action / result → saves as synonym via API, clears local record
- Accessible at any time from team voice settings tab

---

## New Files

| Path | Purpose |
|------|---------|
| `lib/voice/types.ts` | `PendingVoiceAction`, `VoiceVocabularyEntry`, `ParseResult` types |
| `lib/voice/speech-recognition.ts` | `useSpeechRecognition` hook (Web Speech API + availability check) |
| `lib/voice/parser.ts` | `useVoiceParser` hook (fuzzy n-gram matching) |
| `lib/voice/queue.ts` | `useVoiceQueue` hook (rally queue + countdown) |
| `components/matches/live/voice/mic-button.tsx` | Hold-to-talk button + language pill |
| `components/matches/live/voice/voice-validation-drawer.tsx` | Bottom drawer |
| `components/matches/live/voice/voice-action-item.tsx` | Single action row + tag pickers |
| `components/teams/voice/voice-vocabulary-tab.tsx` | Team voice settings tab |
| `components/teams/voice/unmatched-phrases-page.tsx` | Unmatched review UI |
| `app/teams/[id]/voice/page.tsx` | Route for unmatched phrase review |
| `supabase/migrations/YYYYMMDD_voice_vocabulary.sql` | DB migration |
| `messages/en/voice.json` + fr/es/it/pt | i18n strings |

## Modified Files

| Path | Change |
|------|--------|
| `components/matches/live/stat-tracker.tsx` | Add MicButton + wire voice queue; pass match context to drawer |
| `lib/rxdb/schema.ts` | Add `voice_vocabulary` collection; add `voice_unmatched_phrases` collection; add `voice_aliases` to team_members |
| `lib/types.ts` | Add `VoiceVocabulary`, `VoiceUnmatchedPhrase` types; add `voice_aliases?: string[]` to `TeamMember` |
| `app/teams/[id]/page.tsx` | Add "Voice" tab |

---

## Mobile Future (Capacitor)

`useSpeechRecognition` is the only platform-specific layer. Replace with `@capacitor-community/speech-recognition` for the mobile app — fully offline on both iOS and Android. All other hooks, components, and vocabulary logic are unchanged.

---

## Implementation Steps

1. **Database** — Supabase migration: `voice_vocabulary` table + `team_members.voice_aliases[]` column + RLS policies
2. **RxDB schema** — add `voice_vocabulary` and `voice_unmatched_phrases` collections; update `team_members` schema
3. **Types** — add `VoiceVocabulary`, `VoiceUnmatchedPhrase`, `PendingVoiceAction`, `ParseResult` to `lib/types.ts`
4. **Speech hook** — `useSpeechRecognition` with Web Speech API, locale support, and network-availability guard
5. **Parser** — `useVoiceParser` with n-gram fuzzy matching, priority order (player > action > result), vocabulary lookup
6. **Queue** — `useVoiceQueue` with rally accumulation, SUCCESS/ERROR trigger, 5s countdown
7. **MicButton** — hold-to-talk component with all visual states + language pill
8. **VoiceActionItem** — single row with inline tag pickers + position resolution
9. **VoiceValidationDrawer** — assembles action items + countdown (pauses on open picker) + confirm/discard
10. **StatTracker integration** — add MicButton + VoiceValidationDrawer; pass full match context; wire `isRecording` guard
11. **Admin vocabulary seeding** — SQL seed data for en/fr/es/it/pt defaults
12. **i18n** — add `messages/{locale}/voice.json` for all 5 locales
13. **Team voice settings tab** — aliases + synonyms management in team detail page
14. **Unmatched phrase review page** — collect, display, and assign unrecognized phrases

---

## Verification Scenarios

1. Say "Marie service ace" (EN) → drawer: Marie / SERVE / SUCCESS
2. Say "bonne attaque de François" (FR) → drawer: François / SPIKE / GOOD
3. Say "attaque dans le filet de Jo" (FR) → drawer: Jo / SPIKE / ERROR (multi-word synonym)
4. Unknown player name → drawer highlights red; tap player tag → alternatives shown; countdown pauses
5. 5s countdown, no interaction → actions auto-commit via `onStat`/`onPoint` with correct `position` resolved from `current_lineup`
6. "Discard All" → queue cleared, nothing saved
7. Delete one action then confirm → only remaining actions saved
8. Offline macOS Chrome → Web Speech API functions; vocabulary from RxDB
9. Offline Android Chrome → mic button shows "requires network" state; tap UI works normally
10. Add alias "Fifi" for player Marie → "Fifi spike good" resolves to Marie
11. Use unrecognized word "smash" → appears in unmatched review page → assign to spike → works immediately when online (synonym saved to Supabase and pulled back); works after next sync if offline at time of assignment
12. Language pill → switch from FR to EN mid-match → next utterance uses EN recognition
13. Tap mic button while `isRecording` is true → button is disabled, no recording starts
14. Speak GOOD/BAD stat → drawer does NOT open; speak SUCCESS stat → drawer opens with both stats queued
