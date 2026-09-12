import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import en from '@/i18n/locales/en.json';
import ar from '@/i18n/locales/ar.json';

/**
 * Guards translation completeness.
 *
 * Every `t('key')` in the source must exist in both dictionaries, or the user
 * sees the raw key. Pluralized keys are checked through their suffixed forms,
 * which differ per language (Arabic needs six, English two).
 */

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) && !path.includes('__tests__') ? [path] : [];
  });

const collectKeys = () => {
  const keys = new Map<string, string>();
  // Matches t('key') and t("key"), including the second-argument form.
  const pattern = /\bt\(\s*['"]([^'"]+)['"]/g;

  for (const file of walk('src')) {
    const source = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      // Skip dynamically built keys, which are validated separately below.
      if (match[1].includes('${')) continue;
      if (!keys.has(match[1])) keys.set(match[1], file);
    }
  }
  return keys;
};

const resolves = (dict: Record<string, string>, key: string) =>
  key in dict || PLURAL_SUFFIXES.some(suffix => `${key}_${suffix}` in dict);

describe('translation coverage', () => {
  const used = collectKeys();

  it('finds the translation calls to check', () => {
    expect(used.size).toBeGreaterThan(100);
  });

  it('has an Arabic translation for every key used in the UI', () => {
    const missing = [...used.entries()]
      .filter(([key]) => !resolves(ar as Record<string, string>, key))
      .map(([key, file]) => `${key}  (${file})`);
    expect(missing).toEqual([]);
  });

  it('has an English translation for every key used in the UI', () => {
    const missing = [...used.entries()]
      .filter(([key]) => !resolves(en as Record<string, string>, key))
      .map(([key, file]) => `${key}  (${file})`);
    expect(missing).toEqual([]);
  });

  it('keeps the two dictionaries aligned on web keys', () => {
    // Only the dotted namespaced keys added for the web are compared. The flat
    // legacy keys inherited from the mobile app (including prose keys such as
    // "e.g. 1000 km") may legitimately differ between the two dictionaries.
    const namespaced = (dict: Record<string, string>) =>
      Object.keys(dict).filter(key => /^[a-z][a-zA-Z]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(key));

    const enKeys = new Set(namespaced(en as Record<string, string>));
    const arKeys = new Set(namespaced(ar as Record<string, string>));

    const onlyInEn = [...enKeys].filter(key => !arKeys.has(key));
    // Arabic legitimately has extra plural forms English does not need.
    const onlyInAr = [...arKeys]
      .filter(key => !enKeys.has(key))
      .filter(key => !PLURAL_SUFFIXES.some(suffix => key.endsWith(`_${suffix}`)));

    expect(onlyInEn).toEqual([]);
    expect(onlyInAr).toEqual([]);
  });

  it('has no empty translation values', () => {
    const emptyAr = Object.entries(ar).filter(([, value]) => !String(value).trim());
    const emptyEn = Object.entries(en).filter(([, value]) => !String(value).trim());
    expect(emptyAr).toEqual([]);
    expect(emptyEn).toEqual([]);
  });
});
