# Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App Router                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Components (app/ + components/)                │  │
│  │  - Server Components (SSR)                            │  │
│  │  - Client Components (CSR)                            │  │
│  │  - Shadcn/ui + Radix UI                               │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │                                   │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │  State Management Layer                               │  │
│  │  - React Context (AuthContext, LocalDatabaseProvider) │  │
│  │  - Custom Hooks (useTeamApi, useMatchApi, etc.)      │  │
│  │  - Command Pattern (Undo/Redo Stack)                 │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
          ┌────────────────┴─────────────────┐
          │ Other screens                    │ Live match (offline)
   ┌──────▼──────────┐            ┌──────────▼──────────┐
   │   API Layer     │            │  RxDB (Local DB)    │
   │   (lib/api/)    │            │  - Dexie Storage    │
   │  - Repository   │            │  - 12 Collections   │
   │    Pattern      │            │  - Commands write   │
   │  - Factory      │            │    here             │
   │    Pattern      │            └──────────┬──────────┘
   └────────┬────────┘                       │ SyncManager
            │                                │ (RxDB replication)
   ┌────────▼────────────────────────────────▼─┐
   │                 Supabase                  │
   │  - PostgreSQL   - Auth                    │
   │  - Realtime     - RLS                     │
   └───────────────────────────────────────────┘
```

## Data Flow Architecture

Two paths, chosen by screen:

```
Screens other than the live match (teams, championships, match list, settings…)
      ↓
React Component
      ↓
Custom Hook (e.g., useTeamApi)
      ↓
API Layer (lib/api/) → Supabase (direct calls, requires connectivity)


Live match tracking (app/matches/[id]/live)
      ↓
syncMatch(matchId) pulls that one match into RxDB on page load
      ↓
User action → Command (lib/commands/) → RxDB write (useLocalDb)
      ↓
SyncManager replication pushes to Supabase when online
```

Local data stays scoped to what a match needs: reference data plus the matches opened with `syncMatch(matchId)`. Don't sync whole tables to the device. See [04-offline-sync.md](04-offline-sync.md).

## Directory Structure

```
volley-stats/
├── app/                          # Next.js App Router pages
│   ├── auth/                     # Authentication pages
│   ├── championships/            # Championship management
│   ├── matches/                  # Match management
│   │   ├── [id]/live/           # Live match tracking (CORE FEATURE)
│   │   ├── [id]/score/          # Score entry
│   │   └── [id]/stats/          # Match statistics
│   ├── settings/                 # User settings
│   ├── teams/                    # Team management
│   └── api/import/ffvb/          # FFVB match import route
│
├── components/                   # React components (feature-based)
│   ├── auth/                     # Authentication UI
│   ├── championships/            # Championship components
│   ├── clubs/                    # Club management
│   ├── matches/                  # Match-related components
│   │   ├── live/                # Live tracking UI
│   │   └── stats/               # Statistics displays
│   ├── players/                  # Player management
│   ├── providers/                # Context providers
│   │   └── local-database-provider.tsx  # RxDB provider + useLocalDb()
│   ├── teams/                    # Team components
│   └── ui/                       # Shadcn/ui components
│
├── contexts/                     # React Context providers
│   ├── auth-context.tsx         # Authentication context
│   └── keyboard-context.tsx     # Virtual keyboard state (mobile)
│
├── hooks/                        # Custom React hooks
│   ├── use-team-api.ts          # Team API wrapper
│   ├── use-match-api.ts         # Match API wrapper
│   ├── use-local-database.ts    # RxDB instance management
│   ├── use-command-history.ts   # Undo/redo functionality
│   └── use-toast.ts             # Toast notifications
│
├── lib/                          # Core business logic
│   ├── api/                      # API layer (Supabase abstraction)
│   │   ├── datastore.ts         # DataStore interface
│   │   ├── supabase.ts          # SupabaseDataStore implementation
│   │   ├── types.ts             # Filter / Sort types
│   │   ├── championships/       # One createXApi factory per domain:
│   │   ├── clubs/               #   teams, team-members, championships,
│   │   ├── events/              #   clubs, matches, seasons,
│   │   ├── match-formats/       #   match-formats, events
│   │   ├── matches/
│   │   ├── seasons/
│   │   ├── team-members/
│   │   ├── teams/
│   │   └── index.ts             # createApi() / getApi()
│   ├── commands/                 # Command pattern (undo/redo)
│   │   ├── command.ts           # Command, MatchState, CommandHistory
│   │   └── match-commands.ts    # SetSetup, Substitution, PlayerStat, ScorePoint commands
│   ├── i18n/                     # next-intl helpers
│   ├── importers/                # Data import utilities (FFVB)
│   ├── pdf/                      # PDF export types (jsPDF)
│   ├── rxdb/                     # RxDB configuration
│   │   ├── sync/
│   │   │   ├── manager.ts       # SyncManager (what to sync, syncMatch)
│   │   │   └── index.ts         # replicateSupabase (RxDB ↔ Supabase replication)
│   │   ├── database.ts          # RxDB setup (13 collections)
│   │   └── schema.ts            # RxDB schemas
│   ├── stats/                    # Statistics calculation
│   ├── supabase/                 # Supabase client setup
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client
│   │   └── database.types.ts    # Generated DB types (pnpm supabase:types)
│   ├── utils/                    # Utility functions
│   ├── types.ts                  # TypeScript type definitions
│   ├── types/events.ts           # Event types (substitution, timeout, …)
│   └── enums.ts                  # Enums for constants
│
├── messages/                     # next-intl translations (en, es, fr, it, pt)
├── tests/e2e/                    # Playwright E2E tests
│
└── supabase/                     # Supabase configuration
    ├── functions/                # Edge functions (send-email, health)
    └── migrations/               # Database migrations
```
