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
│  │  - React Context (AuthContext, DatabaseContext)       │  │
│  │  - Custom Hooks (useTeamApi, useMatchApi, etc.)      │  │
│  │  - Command Pattern (Undo/Redo Stack)                 │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                  │
   ┌──────▼──────────┐            ┌─────────▼──────────┐
   │   API Layer     │            │  RxDB (Local DB)   │
   │   (lib/api/)    │◄──────────►│  - Dexie Storage   │
   │  - Repository   │   Sync     │  - 13 Collections  │
   │    Pattern      │ Handler    │  - Offline Queue   │
   │  - Factory      │            │  - Change Events   │
   │    Pattern      │            └────────────────────┘
   └────────┬────────┘
            │
   ┌────────▼────────┐
   │    Supabase     │
   │  - PostgreSQL   │
   │  - Auth         │
   │  - Realtime     │
   │  - RLS          │
   └─────────────────┘
```

## Data Flow Architecture

```
User Interaction
      ↓
React Component
      ↓
Custom Hook (e.g., useTeamApi)
      ↓
API Layer (lib/api/)
      ↓
   ┌──┴──┐
   ↓     ↓
RxDB ←→ Supabase
   ↓
SyncHandler (bidirectional sync)
   - Real-time subscriptions
   - Offline queue processing
   - Conflict resolution (LWW)
```

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
│   ├── stats/                    # Statistics views
│   └── teams/                    # Team management
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
│   ├── teams/                    # Team components
│   └── ui/                       # Shadcn/ui components (50+)
│
├── contexts/                     # React Context providers
│   └── auth-context.tsx         # Authentication context
│
├── hooks/                        # Custom React hooks (14 hooks)
│   ├── use-team-api.ts          # Team API wrapper
│   ├── use-match-api.ts         # Match API wrapper
│   ├── use-local-database.ts    # RxDB instance management
│   └── use-command-history.ts   # Undo/redo functionality
│
├── lib/                          # Core business logic
│   ├── api/                      # API layer (Supabase abstraction)
│   │   ├── base/                # Base DataStore interface
│   │   ├── championships/       # Championship API
│   │   ├── clubs/               # Club API
│   │   ├── matches/             # Match API
│   │   ├── seasons/             # Season API
│   │   ├── teams/               # Team API
│   │   └── index.ts             # API factory
│   ├── commands/                 # Command pattern (undo/redo)
│   │   ├── command.ts           # Command interface
│   │   ├── set-setup-command.ts
│   │   ├── substitution-command.ts
│   │   ├── player-stat-command.ts
│   │   └── score-point-command.ts
│   ├── importers/                # Data import utilities
│   ├── pdf/                      # PDF export (jsPDF)
│   ├── rxdb/                     # RxDB configuration
│   │   ├── sync/                # Sync handler
│   │   │   └── sync-handler.ts  # Bidirectional sync logic
│   │   ├── database.ts          # RxDB setup
│   │   └── schema.ts            # RxDB schemas (13 collections)
│   ├── stats/                    # Statistics calculation
│   ├── supabase/                 # Supabase client setup
│   │   ├── client.ts            # Browser client
│   │   └── server.ts            # Server client
│   ├── utils/                    # Utility functions
│   ├── types.ts                  # TypeScript type definitions
│   └── enums.ts                  # Enums for constants
│
└── supabase/                     # Supabase configuration
    └── migrations/               # Database migrations
```
