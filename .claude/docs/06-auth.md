# Authentication & Authorization

## Supabase Auth Setup

**Configuration**:
- Email/password authentication
- Session persistence via cookies (@supabase/ssr)
- Middleware for automatic session refresh

**Client-side Auth** ([contexts/auth-context.tsx](contexts/auth-context.tsx)):
```typescript
interface AuthContextType {
  user: User | null  // Includes profile + team/club memberships
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
  reloadUser: () => Promise<void>
  setUser: (user: User) => void
}

// Usage in components
const { user, isLoading } = useAuth()
```

**Server-side Auth** ([lib/supabase/server.ts](lib/supabase/server.ts)):
- Service role client for privileged operations
- Cookie-based session management
- Used in Server Components and API routes

---

## Authorization Model

### Team-level Roles
- `owner` - Full control of team (can delete, manage all aspects)
- `coach` - Can manage team settings, view/edit matches
- `staff` - Can assist with match tracking, view team data
- `player` - Can be tracked in statistics (limited edit permissions)

### Club-level Roles
- `owner` - Full club control (can delete club, manage all members)
- `admin` - Can manage teams and members within club
- `member` - Basic access to club teams

### Authorization Pattern in Code

```typescript
// Frontend: Role checking for UI rendering
const isTeamOwner = user.team_memberships.some(
  m => m.team_id === teamId && m.role === 'owner'
)

if (isTeamOwner) {
  return <DeleteTeamButton />
}

// Backend: Enforced via RLS policies in Supabase
// Example RLS policy:
// CREATE POLICY "Users can update their own teams"
// ON teams FOR UPDATE
// USING (
//   id IN (
//     SELECT team_id FROM team_members
//     WHERE user_id = auth.uid() AND role IN ('owner', 'coach')
//   )
// );
```

---

## Protected Routes

**Middleware** ([middleware.ts](middleware.ts)):
- Runs on all routes except static assets
- Refreshes Supabase session automatically
- Redirects unauthenticated users to /auth

**Page-level Protection**:
```typescript
// In page components
const { user } = useAuth()
if (!user) {
  redirect('/auth')
}
```
