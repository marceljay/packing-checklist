import { useTranslation } from 'react-i18next';
import { isSupportedLang } from './index';
import type { LanguageCode } from './index';

/**
 * Build language-prefixed app paths for the hash router (`/:lang/...`). The
 * prefix tracks the active language, so `lp('/items')` → `/pt/items` in
 * Portuguese. Use for every internal `Link`/`navigate` so the language segment
 * is carried across navigation. `lp('/')` yields the language home (`/pt`).
 */
export function useLocalePath(): (path: string) => string {
  const { i18n } = useTranslation();
  const lang: LanguageCode = isSupportedLang(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';
  return (path: string) => `/${lang}${path === '/' ? '' : path}`;
}
