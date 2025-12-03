# Claude Code Instructions

## VolleyStats - Volleyball Statistics Management

**Tech Stack**: Next.js 15 + React 18 + TypeScript + Supabase + RxDB (offline-first)

**Key Characteristics**:
- Offline-first architecture (RxDB + Supabase sync)
- Real-time match tracking (core feature)
- PWA with service worker
- Repository pattern for data access (lib/api/)
- Command pattern for undo/redo (lib/commands/)

## Database Schema Quick Reference

**13 Tables** (all with `created_at`, `updated_at`):

**Core Entities**:
- `clubs` - Volleyball organizations
- `club_members` - Membership with roles (owner/admin/member)
- `teams` - Teams (→ clubs, championships)
- `team_members` - Players/staff (→ teams)
- `championships` - Competition categories
- `seasons` - Competition seasons (→ championships)
- `match_formats` - Match rules (2x2, 3x3, 4x4, 6x6)

**Match Data**:
- `matches` - Match records (→ teams, match_formats, seasons)
- `sets` - Individual sets (→ matches)
- `substitutions` - Player subs (→ sets, team_members)
- `score_points` - Point-by-point (→ sets)
- `player_stats` - Individual stats (→ sets, team_members)
- `events` - Match events/comments (→ matches, sets)

**Key Relationships**:
- clubs (1) ←→ (N) teams
- teams (1) ←→ (N) matches (home/away)
- matches (1) ←→ (N) sets
- sets (1) ←→ (N) score_points, player_stats, substitutions

*For detailed schema with all fields and RLS policies, see [.claude/docs/05-database-schema.md](.claude/docs/05-database-schema.md)*

## Quick Reference

### Common Commands
```bash
npm run dev              # Development server
npm run build           # Production build
npm run start           # Production server
task-master next        # Get next task (Task Master)
```

### Key Directories
- `app/` - Next.js App Router pages
- `components/` - React components (feature-based)
- `lib/api/` - API layer (Repository pattern)
- `lib/rxdb/` - RxDB setup and sync (13 collections mirror Supabase)
- `lib/commands/` - Command pattern (undo/redo)
- `.claude/docs/` - Detailed technical documentation

## Development Guidelines

### Essential Patterns
1. **Data Access**: Always use API layer via hooks (e.g., `useTeamApi()`)
2. **Offline First**: Write to RxDB first, sync happens automatically
3. **Error Handling**: Try-catch with toast notifications
4. **Type Safety**: Use types from [lib/types.ts](lib/types.ts)

### When to Read Detailed Documentation

Read specific docs based on your current task (use the Read tool):

**Architecture & Patterns**:
- API patterns? → [.claude/docs/03-code-patterns.md](.claude/docs/03-code-patterns.md)
- System architecture? → [.claude/docs/02-architecture.md](.claude/docs/02-architecture.md)
- Offline sync? → [.claude/docs/04-offline-sync.md](.claude/docs/04-offline-sync.md)

**Feature Development**:
- Full database schema? → [.claude/docs/05-database-schema.md](.claude/docs/05-database-schema.md)
- Adding new features? → [.claude/docs/08-development-guidelines.md](.claude/docs/08-development-guidelines.md)
- Live match tracking? → [.claude/docs/07-features.md](.claude/docs/07-features.md)
- Authentication? → [.claude/docs/06-auth.md](.claude/docs/06-auth.md)

**Full documentation index with task-based guidance**: [.claude/docs/README.md](.claude/docs/README.md)

---

## Task Master AI Integration
@./.taskmaster/CLAUDE.md

---

**Note**: This CLAUDE.md is intentionally lean to reduce context size. Read detailed documentation as needed using the Read tool rather than loading everything upfront.
