import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';

/**
 * Localization for the web client.
 *
 * The dictionaries are the mobile app's own locale files, extended with the
 * keys the web-only screens need. Keys are flat literals (mobile keys such as
 * "Loading..." contain dots), so key/namespace separators are disabled.
 *
 * Only the active language is downloaded; the other is fetched on demand when
 * the user switches, which keeps ~75 kB of JSON out of the initial payload.
 */

export const SUPPORTED_LANGUAGES = [
  {code: 'ar', label: 'العربية', dir: 'rtl' as const},
  {code: 'en', label: 'English', dir: 'ltr' as const},
];

const STORAGE_KEY = 'souqna.lang';

const loadResources = async (language: string): Promise<Record<string, string>> => {
  const module =
    language === 'en'
      ? await import('@/i18n/locales/en.json')
      : await import('@/i18n/locales/ar.json');
  return module.default as Record<string, string>;
};

/** The language a visitor gets when they have never chosen one. */
export const DEFAULT_LANGUAGE = 'ar';

/**
 * Mirrors `normalizeAppLanguage` in the mobile app: anything starting with
 * "ar" is Arabic, everything else is English. Keeping the same rule means a
 * stored value like "ar-SY" resolves identically on both clients.
 */
export const normalizeLanguage = (language: unknown): string =>
  String(language ?? '')
    .toLowerCase()
    .startsWith('ar')
    ? 'ar'
    : 'en';

/**
 * Resolves the active language.
 *
 * Souqna is an Arabic-first marketplace, so a visitor with no stored choice
 * starts in Arabic — deliberately *not* following the browser/OS locale, which
 * would push Arabic-speaking users abroad into English. A language the user
 * picked themselves always wins and is never overwritten.
 */
export const detectLanguage = (): string => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    /* storage unavailable (private browsing) — fall through to the default */
  }

  return DEFAULT_LANGUAGE;
};

export const directionFor = (language: string) =>
  SUPPORTED_LANGUAGES.find(lang => lang.code === language)?.dir ?? 'ltr';

/** Keeps `<html lang>` / `<html dir>` in step with the active language. */
export const applyDocumentLanguage = (language: string) => {
  document.documentElement.setAttribute('lang', language);
  document.documentElement.setAttribute('dir', directionFor(language));
};

/** Initialises i18next with the detected language. Awaited before first paint. */
export const initI18n = async () => {
  const language = detectLanguage();
  const resources = await loadResources(language);

  await i18n.use(initReactI18next).init({
    resources: {[language]: {translation: resources}},
    lng: language,
    fallbackLng: language,
    keySeparator: false,
    nsSeparator: false,
    interpolation: {escapeValue: false},
    returnEmptyString: false,
  });

  applyDocumentLanguage(language);
  return i18n;
};

export const changeLanguage = async (language: string) => {
  const next = normalizeLanguage(language);

  if (!i18n.hasResourceBundle(next, 'translation')) {
    i18n.addResourceBundle(next, 'translation', await loadResources(next));
  }

  await i18n.changeLanguage(next);
  applyDocumentLanguage(next);

  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable — the choice lasts for this page session only */
  }

  return next;
};

/** Picks the localized variant of a backend record (`name` / `ar_name`). */
export const localizedField = <T extends Record<string, any>>(
  record: T | null | undefined,
  field: string,
  language = i18n.language,
): string => {
  if (!record) return '';
  if (language === 'ar') {
    const arabic = record[`ar_${field}`];
    if (typeof arabic === 'string' && arabic.trim()) return arabic.trim();
  }
  const value = record[field];
  return typeof value === 'string' ? value : '';
};

export default i18n;
