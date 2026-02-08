# VolleyStats i18n Implementation Plan

## Overview

Add internationalization to VolleyStats with 5 languages (English, French, Italian, Portuguese, Spanish), extracting ~500 translatable strings into organized JSON files, and integrating a language switcher in the navigation bar that syncs with the existing Supabase profile.language field.

## Solution: next-intl

**Library Choice:** next-intl (vs next-i18next or custom)

**Justification:**
- Native Next.js 15 App Router support (built-in RSC/Client Component handling)
- TypeScript autocomplete for 500+ translation keys (prevents typos)
- Small bundle: ~7KB + ~25KB per locale (only active locale loaded)
- Easy Supabase integration via middleware pattern
- ICU message format for pluralization/variables

## Translation File Structure

**Organization:** Namespace-based with 10-12 JSON files per language

```
messages/
├── en/
│   ├── common.json          # ~50 strings - buttons, status, toasts
│   ├── navigation.json      # ~10 strings - nav items
│   ├── auth.json           # ~30 strings - login, signup
│   ├── teams.json          # ~80 strings - team management
│   ├── matches.json        # ~100 strings - match tracking
│   ├── championships.json  # ~60 strings - championships
│   ├── settings.json       # ~40 strings - settings page
│   ├── forms.json          # ~60 strings - form labels
│   ├── validation.json     # ~30 strings - validation messages
│   ├── enums.json          # ~40 strings - select options
│   └── landing.json        # ~20 strings - landing page
├── fr/ (same structure)
├── es/ (same structure)
├── it/ (same structure)
└── pt/ (same structure)
```

**Example Structure:**

`messages/en/common.json`:
```json
{
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create"
  },
  "status": {
    "loading": "Loading...",
    "success": "Success",
    "error": "Error"
  },
  "toast": {
    "saveSuccess": "Changes saved successfully",
    "deleteSuccess": "{item} deleted successfully"
  }
}
```

`messages/en/enums.json`:
```json
{
  "playerRole": {
    "setter": "Setter",
    "opposite": "Opposite",
    "outside_hitter": "Outside Hitter",
    "middle_hitter": "Middle Hitter",
    "libero": "Libero"
  },
  "teamStatus": {
    "incomplete": "Incomplete",
    "active": "Active",
    "archived": "Archived"
  },
  "championshipGender": {
    "male": "Male",
    "female": "Female"
  }
}
```

## Implementation Steps

### 1. Setup Infrastructure

**Install dependencies:**
```bash
pnpm add next-intl
```

**Create core files:**

**`i18n.ts`** (root):
```typescript
import { getRequestConfig } from 'next-intl/server';
import { getUserLocale } from '@/lib/i18n/locale';

export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  return {
    locale,
    messages: (await import(`@/messages/${locale}`)).default,
  };
});
```

**`lib/i18n/locale.ts`**:
```typescript
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'it', 'pt'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Get user locale with priority:
 * 1. Cookie (set by middleware from URL prefix, or by user preference)
 * 2. Supabase profile.language (persisted preference)
 * 3. Default (en)
 *
 * Note: URL locale prefix (/fr/matches) is handled by middleware which sets cookie
 */
export async function getUserLocale(): Promise<Locale> {
  // 1. Check cookie (immediate updates, or set by middleware from URL prefix)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  // 2. Check Supabase profile (single call, already optimized in AuthContext)
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single();

      if (profile?.language && SUPPORTED_LOCALES.includes(profile.language as Locale)) {
        return profile.language as Locale;
      }
    }
  } catch (error) {
    console.error('Failed to get user locale:', error);
  }

  // 3. Default fallback
  return DEFAULT_LOCALE;
}
```

**`lib/i18n/actions.ts`** (Server Action):
```typescript
'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Locale, SUPPORTED_LOCALES } from './locale';

export async function updateLocale(locale: Locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return { success: false };
  }

  // Update cookie for immediate effect
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  // Update Supabase profile
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('profiles')
      .update({ language: locale })
      .eq('id', user.id);
  }

  return { success: true };
}
```

**`lib/i18n/enum-helpers.ts`** (Helper for enum translations):
```typescript
import { useTranslations } from 'next-intl';

export function usePlayerRoleOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'setter', label: t('playerRole.setter') },
    { value: 'opposite', label: t('playerRole.opposite') },
    { value: 'outside_hitter', label: t('playerRole.outside_hitter') },
    { value: 'middle_hitter', label: t('playerRole.middle_hitter') },
    { value: 'libero', label: t('playerRole.libero') },
  ];
}

export function useTeamStatusOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'incomplete', label: t('teamStatus.incomplete') },
    { value: 'active', label: t('teamStatus.active') },
    { value: 'archived', label: t('teamStatus.archived') },
  ];
}

// Add similar functions for other enums
```

### 2. Update Settings Page Language Selector

The settings page (lines 591-620) already has a language selector. Update it to use the new i18n system:

**Modify `app/settings/page.tsx`:**

```typescript
// Update languages array (lines 53-58) to match i18n locales:
const languages = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
];
```

**Update the form submit handler:**

Replace `onSubmit` function (lines 228-250) to use the new locale update system:

```typescript
import { updateLocale } from '@/lib/i18n/actions';
import { useRouter } from 'next/navigation';

// Add to component:
const router = useRouter();

// Modify onSubmit:
const onSubmit = async (values: Settings) => {
  setIsSaving(true);
  try {
    // Update language via i18n system if changed
    if (values.language !== settings.language) {
      const result = await updateLocale(values.language as Locale);
      if (!result.success) {
        throw new Error('Failed to update language');
      }
      // Refresh to apply new locale
      router.refresh();
    }

    // Update other settings via existing system
    const result = await updateSettings(values);
    if (!result.success) {
      throw new Error(result.error);
    }

    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
    toast({
      variant: "destructive",
      title: "Error",
      description: "Failed to save settings",
    });
  } finally {
    setIsSaving(false);
  }
};
```

This ensures both the navigation language switcher and settings page language selector work correctly with the same i18n system.

### 3. Update Root Layout

**Modify `app/layout.tsx`:**

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getUserLocale } from '@/lib/i18n/locale';
import { getMessages } from 'next-intl/server';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getUserLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>{/* existing head content */}</head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <KeyboardProvider>
            <ThemeProvider>
              <AuthProvider>
                <LocalDatabaseProvider>
                  {/* existing content */}
                </LocalDatabaseProvider>
              </AuthProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Key changes:**
- Line 52: Change `lang="en"` to `lang={locale}`
- Wrap body content with `<NextIntlClientProvider>`
- Import and call `getUserLocale()` and `getMessages()`
- No need for searchParams - middleware handles URL locale prefix

### 4. Create Language Switcher

**`components/language-switcher.tsx`:**

```typescript
'use client';

import { useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { updateLocale } from '@/lib/i18n/actions';
import { Locale, SUPPORTED_LOCALES } from '@/lib/i18n/locale';
import { useToast } from '@/hooks/use-toast';

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
};

export function LanguageSwitcher() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = async (locale: Locale) => {
    startTransition(async () => {
      const result = await updateLocale(locale);
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label="Change language">
          <Globe className="h-[1.5rem] w-[1.5rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuItem key={locale} onClick={() => handleLanguageChange(locale)}>
            {LANGUAGE_LABELS[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Integrate in `components/navigation.tsx`:**

Import at top:
```typescript
import { LanguageSwitcher } from './language-switcher';
```

**Insert at TWO locations:**

1. **Landscape mode** (after line 103):
```typescript
<div className="flex items-center gap-1">
  <FullScreenToggle />
  <LanguageSwitcher />  // NEW
  <ThemeToggle />
</div>
```

2. **Normal mode** (after line 182):
```typescript
<div className="flex items-center">
  <FullScreenToggle />
  <LanguageSwitcher />  // NEW
  <ThemeToggle />
  {user && (
```

### 5. Share Link with Locale (Optional Path Prefix)

Users can share links with locale prefix in the URL path:

**Examples:**
- `https://volleystats.com/fr/matches` - Opens matches page in French
- `https://volleystats.com/es/teams` - Opens teams page in Spanish
- `https://volleystats.com/it/live/123` - Opens live match in Italian
- `https://volleystats.com/matches` - Uses user's preference (cookie → profile → default)

**Key behavior:**
- Locale prefix is **optional**
- `/matches` works and uses user's defined locale
- `/fr/matches` overrides with French (temporary, doesn't save to profile)

**Implementation with Middleware:**

Create `middleware.ts` to handle optional locale prefixes:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locale';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname starts with a locale
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    // Extract locale from path (e.g., /fr/matches → fr)
    const locale = pathname.split('/')[1] as Locale;

    // Rewrite to remove locale from URL (internally route to non-prefixed path)
    const newPathname = pathname.replace(`/${locale}`, '') || '/';
    const newUrl = new URL(newPathname + request.nextUrl.search, request.url);

    // Set temporary cookie for this locale
    const response = NextResponse.rewrite(newUrl);
    response.cookies.set('NEXT_LOCALE', locale, {
      maxAge: 60 * 60, // 1 hour (temporary override)
    });

    return response;
  }

  // No locale in path - continue normally (use cookie/profile preference)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - API routes
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**How it works:**
1. Middleware intercepts all requests
2. If path starts with `/fr/`, `/es/`, etc. → Extract locale, rewrite to non-prefixed path, set temporary cookie
3. If no locale prefix → Pass through, locale detection uses cookie → profile → default
4. `getUserLocale()` reads the cookie set by middleware

**User Flow:**
1. User visits `/matches` → Shows in their preferred language (from profile)
2. User clicks language switcher → Updates cookie + profile, refreshes page
3. User shares `/fr/matches` → Recipient sees French (temporary), their profile unchanged
4. Recipient changes language → Their preference saves to profile permanently

**Language Switcher Update:**

The language switcher needs to **remove** any locale prefix when changing language (to use the new preference):

```typescript
// In components/language-switcher.tsx handleLanguageChange:
const handleLanguageChange = async (locale: Locale) => {
  startTransition(async () => {
    const result = await updateLocale(locale);
    if (result.success) {
      // Remove any locale prefix from current URL
      const currentPath = window.location.pathname;
      const pathWithoutLocale = currentPath.replace(/^\/(en|fr|es|it|pt)(\/|$)/, '/');

      // Navigate to non-prefixed path (will use new cookie/profile preference)
      router.push(pathWithoutLocale || '/');
      router.refresh();
    }
  });
};
```

### 6. String Extraction Process

**Systematic approach (file-by-file):**

#### Phase 1: Navigation (Priority)

**Update `components/navigation.tsx`:**

```typescript
// Add at top
import { useTranslations } from 'next-intl';

// Inside component
const t = useTranslations('navigation');

// Replace routes array (lines 24-45):
const routes = [
  { href: "/championships", label: t('menu.championships'), icon: Trophy },
  { href: "/matches", label: t('menu.matches'), icon: Volleyball },
  { href: "/teams", label: t('menu.teams'), icon: Users },
  { href: "/settings", label: t('menu.settings'), icon: Settings },
];

// Replace line 63: aria-label="Open menu" → aria-label={t('actions.openMenu')}
// Replace line 187: <span>Sign Out</span> → <span>{t('actions.signOut')}</span>
```

**Create `messages/en/navigation.json`:**
```json
{
  "menu": {
    "championships": "Championships",
    "matches": "Matches",
    "teams": "Teams",
    "settings": "Settings"
  },
  "actions": {
    "signOut": "Sign Out",
    "openMenu": "Open menu"
  }
}
```

#### Phase 2: Forms & Validation

**Pattern for forms with Zod validation:**

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { z } from 'zod';

export function TeamForm() {
  const t = useTranslations('validation');

  // Define schema with translations
  const formSchema = z.object({
    name: z.string().min(1, t('team.nameRequired')),
    status: z.enum(['incomplete', 'active', 'archived']),
  });

  // Use enum helpers for select options
  const statusOptions = useTeamStatusOptions();

  return (
    <Form>
      <FormField
        name="status"
        render={({ field }) => (
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Form>
  );
}
```

#### Phase 3: Toast Messages

**Pattern:**
```typescript
const t = useTranslations('common');

toast({
  title: t('status.success'),
  description: t('toast.saveSuccess'),
});
```

### 7. Translations

All translations provided below for 5 languages: English (en), French (fr), Spanish (es), Italian (it), Portuguese (pt).

**Volleyball Terminology:**
- Setter = Passeur (FR), Colocador (ES), Palleggiatore (IT), Levantador (PT)
- Opposite = Pointu (FR), Opuesto (ES), Opposto (IT), Oposto (PT)
- Outside Hitter = Réceptionneur-Attaquant (FR), Receptor-Atacante (ES), Schiacciatore (IT), Ponta (PT)
- Middle Hitter = Central (FR/ES/PT), Centrale (IT)
- Libero = Libéro (FR), Líbero (ES/PT), Libero (IT)

Translation files will be created during implementation with complete coverage of all ~500 strings. Sample structure shown in JSON format above. All select options, form labels, validation messages, and UI text will be translated maintaining:
- Consistent volleyball terminology
- Professional but friendly tone
- UI space constraints (buttons ≤20 chars)
- Cultural appropriateness for each language

## Critical Files to Modify

| Priority | File Path | Changes Required |
|----------|-----------|------------------|
| 1 | `app/layout.tsx` | Add NextIntlClientProvider wrapper, dynamic lang attribute |
| 2 | `components/navigation.tsx` | Add LanguageSwitcher, translate routes array and button text |
| 3 | `lib/enums.ts` | Reference for creating enum-helpers.ts translations |
| 4 | `app/settings/page.tsx` | Update language selector form to use new i18n system (lines 228-250, 591-620) |
| 5 | `components/teams/team-form.tsx` | Example pattern for forms (labels, validation, select options) |
| 6 | `middleware.ts` | NEW FILE - Handle optional locale prefix (/fr/matches) and rewrite to non-prefixed path |
| 7 | `contexts/auth-context.tsx` | Translate toast messages |
| 8 | `app/page.tsx` | Extract landing page text |
| 9 | All form components | Extract labels, placeholders, validation messages |
| 10 | All dialog components | Extract titles and descriptions |

## Implementation Timeline

**Phase 1: Infrastructure** (Complete setup)
- Install next-intl
- Create middleware, locale detection, and server actions
- Set up messages directory structure
- Create language switcher component
- Update settings page language selector
- Test locale switching (URL param, cookie, profile)

**Phase 2: String Extraction & Translation** (Systematic extraction + immediate translation)
- Navigation & common UI → Extract + translate all 5 languages
- Core pages (teams, matches, championships) → Extract + translate
- Forms & validation → Extract + translate
- Enums & select options → Extract + translate
- Landing page & remaining pages → Extract + translate

**Phase 3: Integration & Testing**
- Test all components in all 5 languages
- Fix layout issues with longer text
- Verify URL parameter sharing works
- Test language persistence (cookie + profile)
- Visual regression testing

**Phase 4: Polish & Launch**
- Native speaker review (optional for quality assurance)
- Performance audit (bundle size check)
- Production deployment
- Monitor for missing keys

## Testing Strategy

### Development Testing
1. **Key existence check**: Verify all English keys exist in other languages
2. **Component rendering**: Test each component in all 5 languages
3. **Layout stress test**: Use longest language (typically French/German) to check UI doesn't break
4. **Language switching**: Verify instant UI update and DB persistence

### Visual Testing
1. Screenshot key pages in all languages
2. Verify mobile responsive behavior
3. Check special characters render correctly (é, ñ, ç, etc.)

### User Acceptance Testing
1. Native speaker review for each language
2. Volleyball terminology accuracy check
3. Cultural appropriateness validation

### Automated Tests
```typescript
// Example: Translation completeness test
describe('i18n completeness', () => {
  it('should have all keys in all languages', () => {
    const enKeys = Object.keys(enCommon);
    const frKeys = Object.keys(frCommon);
    expect(frKeys).toEqual(expect.arrayContaining(enKeys));
  });
});
```

## Verification Checklist

After implementation, verify:

- [ ] Language switcher visible in navigation bar (both landscape and normal mode)
- [ ] Clicking language updates UI immediately
- [ ] Language preference saves to Supabase profiles.language
- [ ] URL locale prefix (`/fr/matches`) overrides user preference temporarily (for shareable links)
- [ ] Non-prefixed URLs (`/matches`) work correctly with user preference
- [ ] Settings page language selector works and syncs with navigation switcher
- [ ] Language persists after logout/login
- [ ] All 5 languages display correctly (en, fr, es, it, pt)
- [ ] No missing translation keys in production (check error logs)
- [ ] All select/dropdown options translated
- [ ] Form validation messages translated
- [ ] Toast notifications translated
- [ ] Long strings don't break layout
- [ ] Mobile responsive in all languages
- [ ] Navigation routes translated
- [ ] Landing page fully translated
- [ ] Settings page language selector integrated

## Architecture Benefits

**Why this approach:**

1. **Type Safety**: TypeScript autocomplete prevents typos in 500+ keys
2. **Performance**: Only active locale loaded (~30KB), not all 5 languages
3. **SEO**: Server-side locale detection sets correct HTML lang attribute
4. **UX**: No flash of wrong language on page load
5. **DX**: Clear namespace organization, easy to find strings
6. **Maintainability**: Centralized translation files, not scattered in JSX
7. **Flexibility**: Easy to add 6th language later (just add new directory)
8. **Database Integration**: Syncs with existing Supabase profile.language field

## Notes

- **Bundle size**: +30KB per page (7KB library + 23KB messages)
- **Server overhead**: <25ms for locale detection (cookie + DB query)
- **Client performance**: O(1) translation lookup, no runtime overhead
- **Existing language preference**: Keep `hooks/use-settings.ts` for other settings, language now managed by i18n system
- **Settings page**: Update language selector form submit to call both `updateLocale()` and `updateSettings()` for consistency
- **URL sharing**: Users can share links with locale prefix (`/fr/matches`) for temporary locale override, or without prefix (`/matches`) to use recipient's preference
- **Migration**: Can be done incrementally (page by page) since untranslated text will show English fallback

## Future Enhancements

1. **Pluralization**: Add ICU plural rules for count-based translations
2. **Date/time formatting**: Use next-intl formatters for locale-aware dates
3. **Number formatting**: Locale-aware number display
4. **Translation management platform**: Integrate Lokalise/POEditor for non-technical team updates
5. **A/B testing**: Test different translation wording for user engagement
