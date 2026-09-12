import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

/**
 * Souqna is Arabic-first. These tests pin that contract: a brand-new visitor
 * lands in Arabic RTL regardless of their browser locale, and a language the
 * user picked themselves is never overwritten.
 */

const STORAGE_KEY = 'souqna.lang';

const loadModule = async () => {
  vi.resetModules();
  return import('@/lib/i18n');
};

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('default language', () => {
  it('is Arabic for a first-time visitor', async () => {
    const {detectLanguage, DEFAULT_LANGUAGE} = await loadModule();
    expect(DEFAULT_LANGUAGE).toBe('ar');
    expect(detectLanguage()).toBe('ar');
  });

  it('stays Arabic even when the browser is English or German', async () => {
    const {detectLanguage} = await loadModule();
    vi.stubGlobal('navigator', {...window.navigator, language: 'en-US'});
    expect(detectLanguage()).toBe('ar');
    vi.stubGlobal('navigator', {...window.navigator, language: 'de-DE'});
    expect(detectLanguage()).toBe('ar');
  });

  it('respects a language the user chose before', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'en');
    const {detectLanguage} = await loadModule();
    expect(detectLanguage()).toBe('en');
  });

  it('normalizes regional Arabic tags the way the mobile app does', async () => {
    const {normalizeLanguage} = await loadModule();
    expect(normalizeLanguage('ar-SY')).toBe('ar');
    expect(normalizeLanguage('AR')).toBe('ar');
    expect(normalizeLanguage('en-GB')).toBe('en');
    expect(normalizeLanguage('de')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
  });

  it('falls back to Arabic when storage is unreadable', async () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage blocked');
      });
    const {detectLanguage} = await loadModule();
    expect(detectLanguage()).toBe('ar');
    getItem.mockRestore();
  });
});

describe('direction', () => {
  it('maps Arabic to RTL and English to LTR', async () => {
    const {directionFor} = await loadModule();
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
  });

  it('stamps lang and dir onto the document', async () => {
    const {applyDocumentLanguage} = await loadModule();

    applyDocumentLanguage('ar');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    applyDocumentLanguage('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});

describe('changeLanguage', () => {
  it('switches language, direction and persists the choice', async () => {
    const {initI18n, changeLanguage} = await loadModule();
    await initI18n();

    expect(document.documentElement.getAttribute('dir')).toBe('rtl');

    await changeLanguage('en');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('en');

    await changeLanguage('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ar');
  });
});

describe('localizedField', () => {
  it('prefers the Arabic variant in Arabic and falls back when it is missing', async () => {
    const {localizedField} = await loadModule();
    const category = {name: 'Electronics', ar_name: 'إلكترونيات'};

    expect(localizedField(category, 'name', 'ar')).toBe('إلكترونيات');
    expect(localizedField(category, 'name', 'en')).toBe('Electronics');
    expect(localizedField({name: 'Pets', ar_name: null}, 'name', 'ar')).toBe('Pets');
    expect(localizedField({name: 'Pets', ar_name: '   '}, 'name', 'ar')).toBe('Pets');
    expect(localizedField(null, 'name', 'ar')).toBe('');
  });
});
