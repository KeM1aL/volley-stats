export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'it', 'pt'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: Locale = 'en';
