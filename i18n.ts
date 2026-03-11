import { getRequestConfig } from 'next-intl/server';
import { getUserLocale } from '@/lib/i18n/locale';
import { readFileSync } from 'fs';
import path from 'path';

const FILE_TO_KEY: Record<string, string> = {
  'match-formats': 'matchFormats',
};

const NAMESPACES = [
  'common', 'navigation', 'enums', 'landing', 'auth', 'teams',
  'players', 'clubs', 'matches', 'championships', 'settings',
  'match-formats', 'stats', 'debug', 'errors',
];

function loadMessages(locale: string) {
  const dir = path.join(process.cwd(), 'messages', locale);
  return Object.fromEntries(
    NAMESPACES.map((ns) => [
      FILE_TO_KEY[ns] ?? ns,
      JSON.parse(readFileSync(path.join(dir, `${ns}.json`), 'utf-8')),
    ])
  );
}

export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  return { locale, messages: loadMessages(locale) };
});
