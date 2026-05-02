/**
 * i18n entry point for the Expo mobile app.
 *
 * Loads RU/EN/DE dictionaries, picks initial language from AsyncStorage,
 * falls back to device locale via `expo-localization`, ultimate fallback `de`.
 * `setAppLanguage(lang)` updates state + persists.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ru from './locales/ru.json';
import en from './locales/en.json';
import de from './locales/de.json';

export const SUPPORTED_LANGS = ['de', 'en', 'ru'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: AppLang = 'de';
const STORAGE_KEY = 'app.lang';

function pickInitialLanguage(stored?: string | null): AppLang {
  if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) return stored as AppLang;
  // Pick first supported language from device locales
  try {
    const locales = (Localization.getLocales?.() || []) as Array<{ languageCode?: string }>;
    for (const l of locales) {
      const code = (l?.languageCode || '').toLowerCase();
      if ((SUPPORTED_LANGS as readonly string[]).includes(code)) return code as AppLang;
    }
  } catch {
    /* expo-localization may not be available on web SSR */
  }
  return DEFAULT_LANG;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      de: { translation: de },
    },
    lng: DEFAULT_LANG,
    fallbackLng: DEFAULT_LANG,
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
  });

// Async hydrate from storage so first render uses persisted choice
AsyncStorage.getItem(STORAGE_KEY)
  .then((stored) => {
    const lang = pickInitialLanguage(stored);
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  })
  .catch(() => { /* ignore storage failures */ });

export async function setAppLanguage(lang: AppLang): Promise<void> {
  await i18n.changeLanguage(lang);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function getCurrentLanguage(): AppLang {
  const cur = (i18n.language || DEFAULT_LANG).split('-')[0];
  return ((SUPPORTED_LANGS as readonly string[]).includes(cur) ? cur : DEFAULT_LANG) as AppLang;
}

export default i18n;
