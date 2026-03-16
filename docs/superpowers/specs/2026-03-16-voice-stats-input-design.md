# Voice Stats Input — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Feature:** Optional offline voice input for live match stat tracking

---

## Problem

During live match tracking, recording a stat requires three taps: select player → select action → select result. This is too slow during fast rallies, particularly for solo operators tracking their own team. A hands-free voice alternative is needed.

## Goals

- Let the user narrate actions naturally ("Marie spike good", "bonne attaque de François")
- Work fully offline — no network required during a match
- Support flexible sentence structure and multiple languages
- Show a validation queue before committing any data
- Remain entirely optional — existing tap UI unchanged

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
    → Raw transcript: "bonne attaque de François"
    → VoiceParser:
        1. Tokenize (lowercase, strip punctuation)
        2. Generate n-grams (1..3 tokens)
        3. Match each n-gram against:
             - player names + voice_aliases (fuzzy, team-scoped)
             - action synonyms in voice_vocabulary (exact + fuzzy, language-aware)
             - result synonyms in voice_vocabulary (multi-word phrases supported)
             - stop words (skip)
        4. Longest match wins; assign to player/action/result slots
        5. Unmatched tokens → stored for synonym review
    → PendingVoiceAction: { player, statType, result, confidence, rawTokens, unmatched }
    → Appended to rally queue
```

**Word order is not fixed.** All of these resolve to the same action:
- "good spike Marie"
- "Marie spike good"
- "bonne attaque de François"
- "attaque dans le filet de Jo"  → Jo / SPIKE / ERROR (via multi-word synonym)

### Rally Lifecycle

```
Hold mic × N utterances    →  rally queue grows
Point committed
  (manual score button OR voice action with result = success | error)
    → VoiceValidationDrawer opens
    → 5-second countdown with animated progress bar
    → Auto-confirms on timeout
    → User can edit any field via inline tag picker, delete a line, or Discard All
    → On confirm: calls existing onStat() + onPoint() for each action
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
  results = { player: null, statType: null, result: null, unmatched: [] }
  for ngram in ngrams (longest first):
    try players (name + aliases)
    try action synonyms (language match + '*')
    try result synonyms
    if matched and slot empty → assign
    else if no match → push to unmatched
  return { ...results, confidence: avg(scores), unmatched }
```

---

## UI

### MicButton

- Placed in StatTracker bottom row, **half width**, sharing the row with the Undo button
- **Hold-to-talk**: mousedown/touchstart → record; mouseup/touchend → process
- Visual states: idle (blue), recording (pulsing ring + red indicator), processing (spinner)
- Small language pill nearby — tap to cycle locale or open quick picker

### VoiceValidationDrawer

Opens as a bottom Sheet after a rally point is committed.

```
┌─ Rally Actions ──────────────── Auto-confirm in 4s ─┐
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
- Countdown pauses while a picker is open
- Trash icon (🗑) at end of each line to remove that action

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
  canonical   TEXT NOT NULL,               -- StatType or StatResult enum value
  synonyms    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
-- RLS: team members can read (scope='admin' or team_id=their team)
--      team owners/admins can insert/update/delete (scope='team')
--      app admins can manage scope='admin' rows
```

### Modified table: `team_members`

```sql
ALTER TABLE team_members ADD COLUMN voice_aliases TEXT[] DEFAULT '{}';
```

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
| * | stop_word | — | ["de","du","le","la","les","un","une","the","a","an","by","from"] |

---

## Vocabulary Management

### Team voice settings (new "Voice" tab on team detail page)

- Per-player alias management: add/remove voice aliases on each TeamMember card
- Team action synonym overrides: add synonyms for any canonical action/result
- Link to unmatched phrase review page

### Unmatched phrase review (`/teams/[id]/voice/unmatched`)

- Lists all unrecognized phrases collected during recent matches (stored locally in RxDB)
- For each phrase: assign to player / action / result → saves as team synonym
- Accessible at any time from team settings; no automatic post-match popup

---

## New Files

| Path | Purpose |
|------|---------|
| `lib/voice/types.ts` | `PendingVoiceAction`, `VoiceVocabularyEntry`, `ParseResult` types |
| `lib/voice/speech-recognition.ts` | `useSpeechRecognition` hook (Web Speech API) |
| `lib/voice/parser.ts` | `useVoiceParser` hook (fuzzy n-gram matching) |
| `lib/voice/queue.ts` | `useVoiceQueue` hook (rally queue + countdown) |
| `components/matches/live/voice/mic-button.tsx` | Hold-to-talk button |
| `components/matches/live/voice/voice-validation-drawer.tsx` | Bottom drawer |
| `components/matches/live/voice/voice-action-item.tsx` | Single action row + tag pickers |
| `components/teams/voice/voice-vocabulary-tab.tsx` | Team voice settings tab |
| `components/teams/voice/unmatched-phrases-page.tsx` | Unmatched review UI |
| `app/teams/[id]/voice/page.tsx` | Route for unmatched phrase review |
| `supabase/migrations/YYYYMMDD_voice_vocabulary.sql` | DB migration |

## Modified Files

| Path | Change |
|------|--------|
| `components/matches/live/stat-tracker.tsx` | Add MicButton + wire voice queue |
| `lib/rxdb/schema.ts` | Add `voice_vocabulary` collection; add `voice_aliases` to team_members |
| `lib/types.ts` | Add `VoiceVocabulary` type; add `voice_aliases` to `TeamMember` |
| `components/teams/[id]/page.tsx` | Add "Voice" tab |

---

## Mobile Future (Capacitor)

`useSpeechRecognition` is the only platform-specific layer. Replace with `@capacitor-community/speech-recognition` for the mobile app — all other hooks, components, and vocabulary logic are unchanged.

---

## Verification Scenarios

1. Say "Marie service ace" (EN) → drawer: Marie / SERVE / SUCCESS
2. Say "bonne attaque de François" (FR) → drawer: François / SPIKE / GOOD
3. Say "attaque dans le filet de Jo" (FR) → drawer: Jo / SPIKE / ERROR (multi-word synonym)
4. Unknown player name → drawer highlights red; tap player tag → alternatives shown
5. 5s countdown, no interaction → actions auto-commit via `onStat`/`onPoint`
6. "Discard All" → queue cleared, nothing saved
7. Delete one action then confirm → only remaining actions saved
8. Offline Chrome → Web Speech API still functions; vocabulary from RxDB
9. Add alias "Fifi" for player Marie → "Fifi spike good" resolves to Marie
10. Use unrecognized word "smash" → appears in unmatched review → assign to spike → works next session
11. Language pill in mic area → switch from FR to EN mid-match → next utterance uses EN recognition
