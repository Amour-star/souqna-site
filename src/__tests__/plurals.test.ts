import {beforeAll, describe, expect, it} from 'vitest';
import i18n, {initI18n, changeLanguage} from '@/lib/i18n';

/**
 * Arabic has six plural categories (zero, one, two, few, many, other) where
 * English has two. A key that only supplies one/other silently renders as the
 * raw key for counts like 3 — which is how "search.resultsCount" leaked into
 * the UI. These cases cover every category for every pluralized key.
 */

const PLURAL_KEYS = [
  'search.resultsCount',
  'listing.views',
  'listing.saves',
  'listing.sellerListings',
  'messages.unread',
  'time.minutesAgo',
  'time.hoursAgo',
  'time.daysAgo',
];

// One representative count per Arabic CLDR category.
const COUNTS = [0, 1, 2, 3, 10, 11, 25, 99, 100, 101, 1000];

beforeAll(async () => {
  if (!i18n.isInitialized) await initI18n();
});

describe('Arabic plurals', () => {
  beforeAll(async () => {
    await changeLanguage('ar');
  });

  it.each(PLURAL_KEYS)('%s resolves for every Arabic plural category', key => {
    for (const count of COUNTS) {
      const result = i18n.t(key, {count});
      expect(result, `${key} with count=${count}`).not.toBe(key);
      expect(result, `${key} with count=${count}`).not.toContain('{{count}}');
      expect(result.trim().length).toBeGreaterThan(0);
      // No Latin letters should appear in Arabic output.
      expect(result, `${key} with count=${count}`).not.toMatch(/[A-Za-z]{3}/);
    }
  });

  it('picks distinct wording for the singular, dual and plural forms', () => {
    expect(i18n.t('search.resultsCount', {count: 1})).toBe('نتيجة واحدة');
    expect(i18n.t('search.resultsCount', {count: 2})).toBe('نتيجتان');
    expect(i18n.t('search.resultsCount', {count: 3})).toBe('3 نتائج');
    expect(i18n.t('search.resultsCount', {count: 25})).toBe('25 نتيجة');
  });
});

describe('English plurals', () => {
  beforeAll(async () => {
    await changeLanguage('en');
  });

  it.each(PLURAL_KEYS)('%s resolves for singular and plural', key => {
    for (const count of COUNTS) {
      const result = i18n.t(key, {count});
      expect(result, `${key} with count=${count}`).not.toBe(key);
      expect(result).not.toContain('{{count}}');
    }
  });

  it('uses the singular only for exactly one', () => {
    expect(i18n.t('search.resultsCount', {count: 1})).toBe('1 result');
    expect(i18n.t('search.resultsCount', {count: 2})).toBe('2 results');
  });
});
