'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter, usePathname } from 'next/navigation';
import { updateLocale } from '@/lib/i18n/actions';
import { Locale, SUPPORTED_LOCALES } from '@/lib/i18n/config';

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
};

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = async (locale: Locale) => {
    startTransition(async () => {
      const result = await updateLocale(locale);
      if (result.success) {
        // Remove any locale prefix from current URL
        const currentPath = pathname || '/';
        const pathWithoutLocale = currentPath.replace(/^\/(en|fr|es|it|pt)(\/|$)/, '$2');

        // Navigate to non-prefixed path (will use new cookie/profile preference)
        router.push(pathWithoutLocale || '/');
        router.refresh();
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending} aria-label={t("ui.changeLanguage")}>
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
