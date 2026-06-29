import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

/**
 * UI language support (react-i18next). Only interface chrome is translated;
 * item names, categories, tags and notes stay in their original language (that
 * text is data held in the library/catalog — see docs/architecture.md). English
 * is the source of truth and the fallback. The chosen language persists under
 * `packing-checklist-lang`, matching the app's other `packing-checklist-*`
 * preference keys; on first visit the browser language is used if supported.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const LANGUAGE_STORAGE_KEY = 'packing-checklist-lang';

export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/** Narrow an arbitrary URL segment to a supported language code. */
export function isSupportedLang(code: string | undefined): code is LanguageCode {
  return code != null && (SUPPORTED_CODES as readonly string[]).includes(code);
}

/** The active base language, always one of {@link SUPPORTED_CODES}. */
export function resolvedLang(): LanguageCode {
  return isSupportedLang(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';
}

/** Initialise i18next once. Idempotent (safe to call in tests and main.tsx). */
export function initI18n() {
  if (i18n.isInitialized) return i18n;
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        de: { translation: de },
        fr: { translation: fr },
        es: { translation: es },
        pt: { translation: pt },
      },
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_CODES,
      // Treat region variants (de-DE, pt-BR…) as their base language.
      nonExplicitSupportedLngs: true,
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
      },
      interpolation: { escapeValue: false },
    });
  return i18n;
}

export default i18n;
