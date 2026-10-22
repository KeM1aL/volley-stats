'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppLocale } from '@/hooks/use-app-locale';
import { Locale, SUPPORTED_LOCALES } from '@/lib/i18n/config';

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
};

const LANGUAGE_FLAG_CODES: Record<Locale, string> = {
  en: 'gb',
  fr: 'fr',
  es: 'es',
  it: 'it',
  pt: 'pt',
};

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const { locale: currentLocale, setLocale } = useAppLocale();
  const [isPending, startTransition] = useTransition();

  const handleLanguageChange = (locale: Locale) => {
    startTransition(async () => {
      await setLocale(locale);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} aria-label={t("ui.changeLanguage")} className="gap-1.5">
          <span className={`fi fi-${LANGUAGE_FLAG_CODES[currentLocale]} fis rounded-sm`} style={{ width: '1.2rem', height: '1.2rem' }} />
          <span className="text-xs font-medium">{currentLocale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LOCALES.map((locale) => (
          <DropdownMenuItem key={locale} onClick={() => handleLanguageChange(locale)}>
            <span className={`fi fi-${LANGUAGE_FLAG_CODES[locale]} fis rounded-sm mr-2`} style={{ width: '1.2rem', height: '1.2rem' }} />
            {LANGUAGE_LABELS[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
