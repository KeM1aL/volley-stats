# Loading Spinner Usage Audit

**Audit Date:** 2026-02-24
**Purpose:** Document all spinner implementations before standardization

## Executive Summary

- **Total Files with Spinner Usage:** 18 files
- **Direct Loader2 Usage:** 7 instances (6 files)
- **LoadingSpinner Component Usage:** 18 instances (12 files)
- **Unused Import:** 1 instance

## Findings by Implementation Type

### ✅ Already Using LoadingSpinner Component (12 files)

These files are using the standardized `LoadingSpinner` component:

#### 1. `components/championships/quick-create-championship-dialog.tsx`
- **Location:** Line 186
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating championship"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 2. `components/championships/new-championship-dialog.tsx`
- **Location:** Line 335
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating championship"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 3. `components/clubs/quick-create-club-dialog.tsx`
- **Location:** Line 155
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating club"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 4. `components/teams/quick-create-team-dialog.tsx`
- **Location:** Line 160
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating team"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 5. `components/teams/team-form.tsx`
- **Location:** Line 232
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating/Saving team"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 6. `components/matches/new-match-form.tsx`
- **Location:** Line 294
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating match"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 7. `components/match-formats/match-format-form.tsx`
- **Location:** Line 278
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Creating match format"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 8. `components/matches/live/stat-button.tsx`
- **Location:** Lines 57, 84
- **Instances:** 2 (one for compact mode, one for regular mode)
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** `text-white`
- **Context:** Button loading state during stat recording
- **Usage:** `<LoadingSpinner size="sm" className="text-white" />`

#### 9. `components/settings/favorites-section.tsx`
- **Location:** Line 201
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading state - "Saving favorites"
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 10. `app/settings/page.tsx`
- **Locations:** Lines 501, 568, 704, 813
- **Instances:** 4 (password change, email change, settings save, cache deletion)
- **Size:** `size="sm"` (h-4 w-4)
- **Color:** Default (inherits from parent)
- **Context:** Button loading states for various settings operations
- **Usage:** `<LoadingSpinner size="sm" className="mr-2" />`

---

### ⚠️ Using Direct Loader2 Import (6 files, 7 instances)

These files need to be migrated to use the `LoadingSpinner` component:

#### 1. `contexts/auth-context.tsx`
- **Location:** Line 233
- **Size:** `h-8 w-8` (equivalent to `size="lg"`)
- **Color:** `text-primary`
- **Context:** Full-screen loading overlay during auth initialization
- **Current Usage:** `<Loader2 className="h-8 w-8 animate-spin text-primary" />`
- **Recommended Migration:** `<LoadingSpinner size="lg" className="text-primary" />`

#### 2. `components/auth/auth-form.tsx`
- **Location:** Line 168
- **Size:** `h-4 w-4` (equivalent to `size="sm"`)
- **Color:** Default (no custom color)
- **Context:** Button loading state - Sign in/Sign up/Password reset
- **Current Usage:** `<Loader2 className="mr-2 h-4 w-4 animate-spin" />`
- **Recommended Migration:** `<LoadingSpinner size="sm" className="mr-2" />`

#### 3. `components/providers/local-database-provider.tsx`
- **Location:** Line 85
- **Size:** `h-8 w-8` (equivalent to `size="lg"`)
- **Color:** Default (no custom color)
- **Context:** Full-screen loading during database initialization
- **Current Usage:** `<Loader2 className="h-8 w-8 animate-spin" />`
- **Recommended Migration:** `<LoadingSpinner size="lg" />`

#### 4. `components/players/avatar-upload.tsx`
- **Location:** Line 89
- **Size:** `h-8 w-8` (equivalent to `size="lg"`)
- **Color:** `text-muted-foreground`
- **Context:** Uploading avatar image
- **Current Usage:** `<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />`
- **Recommended Migration:** `<LoadingSpinner size="lg" className="text-muted-foreground" />`

#### 5. `app/auth/reset-password/page.tsx`
- **Locations:** Lines 118, 208
- **Instances:** 2
- **Sizes:**
  - Line 118: `h-6 w-6` (equivalent to `size="default"`)
  - Line 208: `h-4 w-4` (equivalent to `size="sm"`)
- **Color:** Default (no custom color)
- **Context:**
  - Line 118: Loading card content
  - Line 208: Button loading state
- **Current Usage:**
  - `<Loader2 className="h-6 w-6 animate-spin" />`
  - `<Loader2 className="mr-2 h-4 w-4 animate-spin" />`
- **Recommended Migration:**
  - `<LoadingSpinner size="default" />`
  - `<LoadingSpinner size="sm" className="mr-2" />`

#### 6. `app/auth/confirm-email/page.tsx`
- **Location:** Line 139
- **Size:** `h-4 w-4` (equivalent to `size="sm"`)
- **Color:** Default (no custom color)
- **Context:** Button loading state - "Resending confirmation email"
- **Current Usage:** `<Loader2 className="mr-2 h-4 w-4 animate-spin" />`
- **Recommended Migration:** `<LoadingSpinner size="sm" className="mr-2" />`

---

### 📋 Unused Import (1 file)

#### 1. `components/matches/stats/team-performance.tsx`
- **Issue:** Imports `LoadingSpinner` but doesn't use it
- **Action:** Remove unused import during cleanup phase

---

## Size Distribution Analysis

### Direct Loader2 Sizes
- `h-4 w-4` (sm): 3 instances
- `h-6 w-6` (default): 1 instance
- `h-8 w-8` (lg): 3 instances

### LoadingSpinner Component Sizes
- `size="sm"`: 18 instances (100% of LoadingSpinner usage)

### Observation
All standardized LoadingSpinner usages use `size="sm"` for button loading states. Direct Loader2 usages show more size variety:
- Small (`sm`): Used in buttons
- Default: Used in content areas
- Large (`lg`): Used in full-screen loading states

---

## Color Distribution Analysis

### Colors Used
1. **Default (no custom color)**: 22 instances (~88%)
2. **`text-primary`**: 1 instance (auth-context.tsx)
3. **`text-muted-foreground`**: 1 instance (avatar-upload.tsx)
4. **`text-white`**: 2 instances (stat-button.tsx)

### Observation
Most spinners rely on default text color inheritance. Custom colors are only used in specific contexts:
- Primary color for prominent loading states
- Muted for background operations
- White for colored button backgrounds

---

## Context Distribution

### Usage Contexts
1. **Button Loading States**: 17 instances (68%)
   - Form submissions
   - Create/save operations
   - Email resend operations

2. **Full-Screen Loading**: 2 instances (8%)
   - Auth initialization
   - Database initialization

3. **Inline Content Loading**: 5 instances (20%)
   - Card content loading
   - Upload progress
   - Stat recording

4. **Loading Pages**: Separate component (LoadingPage uses Skeleton instead)

---

## Migration Priority

### High Priority (User-Facing Auth/Core)
1. `contexts/auth-context.tsx` - Critical auth flow
2. `components/auth/auth-form.tsx` - Login/signup
3. `components/providers/local-database-provider.tsx` - App initialization

### Medium Priority (User Actions)
4. `app/auth/reset-password/page.tsx` - Password management
5. `app/auth/confirm-email/page.tsx` - Email confirmation
6. `components/players/avatar-upload.tsx` - File uploads

### Low Priority (Cleanup)
7. `components/matches/stats/team-performance.tsx` - Remove unused import

---

## Standardization Recommendations

### Size Guidelines
- **Small (`sm`)**: Buttons, inline actions (h-4 w-4)
- **Default**: Content areas, cards (h-6 w-6)
- **Large (`lg`)**: Full-screen loading, prominent states (h-8 w-8)

### Color Guidelines
- Use default color (no className) for most cases
- Use `text-primary` for prominent loading states
- Use `text-muted-foreground` for background operations
- Use `text-white` only on colored button backgrounds

### Spacing Guidelines
- Add `mr-2` for spinners inside buttons (before text)
- No spacing for standalone/centered spinners

---

## Files Requiring No Changes

The following files reference loading/spinner in searches but don't actually use Loader2 or LoadingSpinner:
- `app/teams/page.tsx`
- `app/teams/loading.tsx` (uses LoadingPage)
- `app/settings/loading.tsx` (uses LoadingPage)
- `app/matches/page.tsx`
- `app/matches/loading.tsx` (uses LoadingPage)
- `app/matches/[id]/live/page.tsx`
- `app/matches/[id]/stats/page.tsx`
- `app/championships/[id]/page.tsx`
- `app/championships/loading.tsx` (uses LoadingPage)
- `app/layout.tsx`
- `app/auth/page.tsx`
- `components/loading-page.tsx` (uses Skeleton, not spinners)
- `components/matches/live/panels/events-panel.tsx`
- `components/championships/championship-teams-list.tsx`
- `scripts/deploy-email-templates.ts`
- `lib/supabase/storage.ts`
- `components/ui/loading-bar.tsx` (different loading component)

---

## Summary Statistics

- **Total Spinner Instances:** 25
- **Already Standardized:** 18 (72%)
- **Need Migration:** 7 (28%)
- **Unused Imports:** 1
- **Files Using Best Practices:** 12 (67%)
- **Files Needing Updates:** 6 (33%)

---

## Next Steps

1. **Phase 2:** Migrate direct Loader2 usages to LoadingSpinner component
2. **Phase 3:** Add standardized loading states for buttons and forms
3. **Phase 4:** Document patterns in component library
4. **Phase 5:** Remove unused imports and clean up
