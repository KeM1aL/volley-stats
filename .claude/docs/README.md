# VolleyStats Technical Documentation Index

Complete technical documentation for the VolleyStats volleyball statistics management application.

**Quick Start**: For most tasks, you only need 1-2 specific docs. Use the task-based guide below to find what you need.

---

## Core Architecture Documentation

### [01-project-overview.md](01-project-overview.md)
**Purpose**: High-level project introduction, tech stack summary, and statistics
**When to read**: First time working on the project, or when you need a quick refresher
**Contains**: Application purpose, core tech stack, project statistics
**Reading time**: ~2 minutes

### [02-architecture.md](02-architecture.md)
**Purpose**: System architecture, data flow, and directory structure
**When to read**: Understanding system design, component relationships, or data flow patterns
**Contains**: High-level architecture diagrams, data flow, directory structure, layer descriptions
**Reading time**: ~5 minutes

### [03-code-patterns.md](03-code-patterns.md)
**Purpose**: Core design patterns and coding conventions
**When to read**:
- Implementing new API endpoints
- Working with data access layer
- Adding undo/redo functionality
- Understanding state management

**Contains**:
- Repository pattern (API layer)
- Command pattern (undo/redo)
- State management strategy
- Factory pattern usage

**Reading time**: ~8 minutes

### [04-offline-sync.md](04-offline-sync.md)
**Purpose**: Offline-first architecture and synchronization mechanism
**When to read**:
- Debugging sync issues
- Adding new tables/collections
- Understanding offline behavior
- Implementing conflict resolution

**Contains**:
- RxDB configuration (13 collections)
- SyncHandler bidirectional sync logic
- Offline queue mechanism
- Conflict resolution (LWW)
- What works offline vs. online

**Reading time**: ~7 minutes

---

## Data & Security Documentation

### [05-database-schema.md](05-database-schema.md)
**Purpose**: Complete database schema with all fields and relationships
**When to read**:
- Adding new tables or columns
- Understanding data relationships
- Writing complex queries
- Implementing RLS policies

**Contains**:
- All 13 tables with complete field definitions
- TypeScript type definitions
- Relationship diagrams
- RLS policy descriptions

**Reading time**: ~10 minutes
**Note**: The main CLAUDE.md includes a quick reference with table names - read this for full details

### [06-auth.md](06-auth.md)
**Purpose**: Authentication and authorization model
**When to read**:
- Implementing auth-related features
- Understanding user roles and permissions
- Working with protected routes
- Debugging auth issues

**Contains**:
- Supabase Auth configuration
- Team-level and club-level roles
- Authorization patterns in code
- Protected route implementation
- RLS policy examples

**Reading time**: ~4 minutes

---

## Feature & Development Documentation

### [07-features.md](07-features.md)
**Purpose**: Detailed documentation of key features
**When to read**:
- Working on live match tracking
- Implementing statistics/analytics
- Adding team/player management features
- Implementing PDF export

**Contains**:
- Live match tracking (core feature) implementation
- Team & player management workflows
- Statistics calculation algorithms
- Championship management
- PDF export functionality

**Reading time**: ~8 minutes

### [08-development-guidelines.md](08-development-guidelines.md)
**Purpose**: Coding standards, patterns, and best practices
**When to read**:
- Adding new features (essential!)
- Writing error handling code
- Using the API layer
- Ensuring offline compatibility

**Contains**:
- Naming conventions
- Error handling patterns
- API layer usage examples
- Offline-first checklist for new features
- Performance considerations

**Reading time**: ~10 minutes
**Important**: Read the "Adding New Features" checklist before implementing any new functionality

---

## Reference Documentation

### [09-migration-testing.md](09-migration-testing.md)
**Purpose**: Migration path to separate API and testing strategy
**When to read**:
- Planning to migrate from Supabase to custom API
- Setting up testing infrastructure
- Understanding migration effort

**Contains**:
- Step-by-step migration plan from Supabase to REST API
- Testing strategy recommendations (unit, integration, E2E)
- Example test code
- Migration effort estimates

**Reading time**: ~6 minutes

### [10-deployment-future.md](10-deployment-future.md)
**Purpose**: Deployment configuration and future enhancement plans
**When to read**:
- Deploying to production
- Reviewing security considerations
- Planning future features
- Optimizing performance

**Contains**:
- Deployment recommendations (Vercel)
- Environment variables required
- Security considerations checklist
- Future enhancement roadmap (prioritized)
- Common commands reference

**Reading time**: ~5 minutes

---

## Task-Based Documentation Guide

### "I need to add a new feature"
1. **Start**: [08-development-guidelines.md](08-development-guidelines.md) - Section "Adding New Features (Offline-First Checklist)"
2. **If adding a table**: [05-database-schema.md](05-database-schema.md) + [04-offline-sync.md](04-offline-sync.md)
3. **If using API**: [03-code-patterns.md](03-code-patterns.md) - Section "API Layer"

### "I need to understand how X feature works"
1. **Live match tracking**: [07-features.md](07-features.md) - Section "Live Match Tracking"
2. **Statistics**: [07-features.md](07-features.md) - Section "Statistics & Analytics"
3. **Sync mechanism**: [04-offline-sync.md](04-offline-sync.md)
4. **Authentication**: [06-auth.md](06-auth.md)

### "I'm getting an error with..."
1. **Sync/offline issues**: [04-offline-sync.md](04-offline-sync.md)
2. **API calls**: [03-code-patterns.md](03-code-patterns.md) + [08-development-guidelines.md](08-development-guidelines.md)
3. **Auth/permissions**: [06-auth.md](06-auth.md)
4. **Database queries**: [05-database-schema.md](05-database-schema.md)

### "I'm new to the codebase"
Read in this order:
1. [01-project-overview.md](01-project-overview.md) - Get oriented (~2 min)
2. [02-architecture.md](02-architecture.md) - Understand structure (~5 min)
3. [03-code-patterns.md](03-code-patterns.md) - Learn patterns (~8 min)
4. [08-development-guidelines.md](08-development-guidelines.md) - Follow conventions (~10 min)

**Total onboarding time**: ~25 minutes

### "I need to work on the database"
1. **Quick reference**: Check main CLAUDE.md (table names & relationships)
2. **Full details**: [05-database-schema.md](05-database-schema.md) (all fields, types, RLS)
3. **Adding tables**: [08-development-guidelines.md](08-development-guidelines.md) + [04-offline-sync.md](04-offline-sync.md)

### "I need to deploy or optimize"
1. [10-deployment-future.md](10-deployment-future.md) - Deployment & optimization
2. [08-development-guidelines.md](08-development-guidelines.md) - Performance considerations

---

## Documentation Maintenance

**Last Updated**: 2025-12-02
**Total Documentation**: ~1,445 lines across 10 files
**Avg Reading Time**: ~6.5 minutes per file

**Note**: This documentation is reference material. The main [CLAUDE.md](../../CLAUDE.md) file provides essential context and is automatically loaded. Read these docs as needed using the Read tool.

### Quick Navigation

- [← Back to CLAUDE.md](../../CLAUDE.md)
- [Task Master Guide](../../.taskmaster/CLAUDE.md)
- [Main Codebase](../../)
