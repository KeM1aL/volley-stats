# Deployment & Future Enhancements

## Performance Optimizations

### Current
- React.memo for expensive components
- useCallback for event handlers
- useMemo for complex calculations
- IndexedDB (RxDB) for fast local queries during live match tracking
- PWA caching for static assets

### Recommended
- Implement virtualization for large lists (react-window)
- Add pagination to API calls (currently loads all)
- Optimize images (use Next.js Image if online-only)
- Code splitting for route-based lazy loading
- Debounce search/filter inputs

---

## Security Considerations

- ✅ Row Level Security (RLS) in Supabase enforces authorization
- ✅ Service role key only on server (never exposed to client)
- ✅ Anon key for client (limited permissions)
- ✅ Auth middleware for protected routes
- ✅ HTTPS enforced (via Supabase and Vercel)
- ⚠️ Consider rate limiting for API calls
- ⚠️ Add CSRF protection for mutations
- ⚠️ Implement input sanitization for user-generated content

---

## Deployment

### Recommended Platform
Vercel (optimized for Next.js)

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only
```

### Build Configuration
- **Build Command**: `pnpm build`
- **Start Command**: `pnpm start`
- **PWA Configuration**: Serwist service worker (app/sw.ts), built by the /serwist route at build time
- **Package manager**: pnpm 12 (`packageManager` in package.json) on Node 24 (`engines`, `.nvmrc`). The host must use pnpm 12, e.g. by enabling Corepack (on Vercel: `ENABLE_EXPERIMENTAL_COREPACK=1`). Older pnpm versions ignore the `allowBuilds` list in `pnpm-workspace.yaml`, which allows install scripts for `esbuild` (service worker bundling), `rxdb` and `supabase`.
- **Release-age delay**: pnpm 12 does not install versions published in the last day, so a fresh release may only be picked up by `pnpm update` a day later.

---

## Future Enhancements

### High Priority
1. **Unit & Integration Tests**: Add unit/integration tests alongside the Playwright E2E suite (see [09-migration-testing.md](09-migration-testing.md))
2. **Championship Standings**: Leaderboard and rankings
3. **Team Chat**: Real-time messaging for team members
4. **Video Analysis**: Link video clips to specific points
5. **Advanced Analytics**: ML-based insights and recommendations

### Medium Priority
6. **Export to Excel**: CSV/XLSX export for stats
7. **Custom Reports**: User-defined stat reports
8. **Notifications**: Push notifications for match updates
9. **API Rate Limiting**: Protect against abuse

### Low Priority
10. **Social Features**: Share stats on social media
11. **Gamification**: Badges and achievements
12. **Dark Mode Improvements**: Better contrast and themes
13. **Accessibility**: WCAG 2.1 compliance
14. **Mobile Apps**: React Native or Capacitor (see [capacitor-integration.md](capacitor-integration.md))

---

## Quick Reference

### Common Commands
```bash
# Development
pnpm dev              # Start dev server
pnpm build           # Build for production
pnpm start           # Start production server

# Database
npx supabase migration new <name>  # Create migration
npx supabase db reset              # Reset local database
pnpm supabase:types             # Regenerate lib/supabase/database.types.ts

# Code Quality
pnpm lint            # Run ESLint
npx tsc --noEmit        # Type-check
pnpm i18n:check      # Check translation keys across locales in messages/

# Tests
CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e  # Playwright E2E against pnpm start -p 3100
pnpm test:e2e:ui     # Playwright UI mode
```

### Key File Locations
- API Layer: [lib/api/](lib/api/)
- RxDB Setup: [lib/rxdb/database.ts](lib/rxdb/database.ts)
- Sync Logic: [lib/rxdb/sync/manager.ts](lib/rxdb/sync/manager.ts) (SyncManager), [lib/rxdb/sync/index.ts](lib/rxdb/sync/index.ts) (replicateSupabase)
- Auth Context: [contexts/auth-context.tsx](contexts/auth-context.tsx)
- Local DB Provider: [components/providers/local-database-provider.tsx](components/providers/local-database-provider.tsx) (`useLocalDb`)
- Supabase Client: [lib/supabase/client.ts](lib/supabase/client.ts)
- Types: [lib/types.ts](lib/types.ts), generated DB types [lib/supabase/database.types.ts](lib/supabase/database.types.ts)
- Commands: [lib/commands/match-commands.ts](lib/commands/match-commands.ts)
- Live Match: [app/matches/[id]/live/page.tsx](app/matches/[id]/live/page.tsx)

### Important Patterns
- **Data Access**: Screens other than the live match read and write live data through the API layer via hooks (e.g. `useTeamApi()`), which call Supabase directly
- **Offline Live Match**: Live match tracking writes to RxDB (`useLocalDb` + `lib/commands`) and `SyncManager` replicates to Supabase in the background
- **Scoped Local Data**: Keep RxDB data to what a match needs (`syncMatch(matchId)` pulls one match on demand); don't sync whole tables
- **Error Handling**: Try-catch with toast notifications
- **Type Safety**: Use generated Supabase types + custom types in [types.ts](lib/types.ts)
