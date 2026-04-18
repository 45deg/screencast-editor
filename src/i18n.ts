import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { enTranslation } from './i18n/resources/en';
import { jaTranslation } from './i18n/resources/ja';

const SUPPORTED_LANGUAGES = ['en', 'ja'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    translation: enTranslation,
  },
  ja: {
    translation: jaTranslation,
  },
} as const;

function normalizeLanguageTag(languageTag: string | null | undefined): SupportedLanguage {
  const primaryLanguage = languageTag?.toLowerCase().split('-')[0];
  return primaryLanguage === 'ja' ? 'ja' : 'en';
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const candidate of candidates) {
    const normalized = normalizeLanguageTag(candidate);
    if (SUPPORTED_LANGUAGES.includes(normalized)) {
      return normalized;
    }
  }

  return 'en';
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: detectInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;
  void i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
}

export { i18n };
