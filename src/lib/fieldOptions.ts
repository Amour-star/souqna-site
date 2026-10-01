import type {CategoryField} from '@/types';

/**
 * Category-attribute option lists, read exactly the way the mobile app reads
 * them (`CategoryFields.js`), so a listing created on either client stores the
 * same value.
 *
 * `options` is a JSON string `{"ar": "a,b,c", "en": "x,y,z"}` whose two lists
 * line up by index. Older rows hold a plain comma-separated string instead.
 *
 * The **English** entry is the canonical stored value; Arabic is display-only.
 * Storing the translated label would make the same option look different to
 * the app's filters and to any other client.
 */

export interface FieldOption {
  /** What the user sees, in the current language. */
  label: string;
  /** What is stored on the listing (canonical, language-independent). */
  value: string;
}

const splitList = (value: unknown): string[] =>
  String(value ?? '')
    .split(',')
    .map(option => option.trim())
    .filter(Boolean);

const parseOptionLists = (field: Pick<CategoryField, 'options' | 'ar_options'>) => {
  const raw = field.options;
  if (!raw) return {ar: [] as string[], en: [] as string[]};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {ar: splitList(parsed.ar), en: splitList(parsed.en)};
    }
  } catch {
    /* not JSON: fall through to the legacy format */
  }

  const legacy = splitList(raw);
  const legacyArabic = splitList(field.ar_options);
  return {
    en: legacy,
    // A separate `ar_options` column is honoured when it lines up with `options`.
    ar: legacyArabic.length === legacy.length ? legacyArabic : legacy,
  };
};

export const fieldOptions = (
  field: Pick<CategoryField, 'options' | 'ar_options'>,
  language: string,
): FieldOption[] => {
  const {ar, en} = parseOptionLists(field);
  const useArabic = language.startsWith('ar');
  // The two lists can differ in length if the admin edited only one; the longer
  // one wins so no option silently disappears.
  const length = Math.max(en.length, useArabic ? ar.length : 0);
  return Array.from({length}, (_, index) => {
    const value = en[index] || ar[index] || '';
    return {value, label: (useArabic ? ar[index] : en[index]) || value};
  }).filter(option => option.value);
};

/** Label for a stored value; falls back to the raw value for unknown ones. */
export const optionLabel = (options: FieldOption[], stored: string): string =>
  options.find(option => option.value === stored)?.label ?? stored;
