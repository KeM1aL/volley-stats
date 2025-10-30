# Deployment & Future Enhancements

## Performance Optimizations

### Current
- React.memo for expensive components
- useCallback for event handlers
- useMemo for complex calculations
- IndexedDB for fast local queries
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
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **PWA Configuration**: Automatic via next-pwa

---

## Future Enhancements

### High Priority
1. **Testing Suite**: Add comprehensive tests (unit + E2E)
2. **Championship Standings**: Leaderboard and rankings
3. **Team Chat**: Real-time messaging for team members
4. **Video Analysis**: Link video clips to specific points
5. **Advanced Analytics**: ML-based insights and recommendations

### Medium Priority
6. **Multi-language Support**: i18n for French, Dutch, etc.
7. **Export to Excel**: CSV/XLSX export for stats
8. **Custom Reports**: User-defined stat reports
9. **Notifications**: Push notifications for match updates
10. **API Rate Limiting**: Protect against abuse

### Low Priority
11. **Social Features**: Share stats on social media
12. **Gamification**: Badges and achievements
13. **Dark Mode Improvements**: Better contrast and themes
14. **Accessibility**: WCAG 2.1 compliance
15. **Mobile Apps**: React Native or Capacitor

---

## Quick Reference

### Common Commands
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx supabase migration new <name>  # Create migration
npx supabase db reset              # Reset local database

# Code Quality
npm run lint            # Run ESLint
npm run type-check     # Run TypeScript compiler
```

### Key File Locations
- API Layer: [lib/api/](lib/api/)
- RxDB Setup: [lib/rxdb/database.ts](lib/rxdb/database.ts)
- Sync Logic: [lib/rxdb/sync/sync-handler.ts](lib/rxdb/sync/sync-handler.ts)
- Auth Context: [contexts/auth-context.tsx](contexts/auth-context.tsx)
- Supabase Client: [lib/supabase/client.ts](lib/supabase/client.ts)
- Types: [lib/types.ts](lib/types.ts)
- Commands: [lib/commands/](lib/commands/)
- Live Match: [app/matches/[id]/live/page.tsx](app/matches/[id]/live/page.tsx)

### Important Patterns
- **Data Access**: Always use API layer via hooks (never direct Supabase calls)
- **State Updates**: Optimistic UI → RxDB → Sync → Supabase
- **Error Handling**: Try-catch with toast notifications
- **Offline First**: Write to RxDB first, sync in background
- **Type Safety**: Use generated Supabase types + custom types in [types.ts](lib/types.ts)
