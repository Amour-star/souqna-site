import axios from 'axios';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import ar from '@/i18n/locales/ar.json';
import en from '@/i18n/locales/en.json';
import i18n, {changeLanguage, initI18n} from '@/lib/i18n';

const post = vi.fn();
const get = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {post, get},
  getAccessToken: () => null,
}));

const {
  IMPORT_ERROR_CODES,
  clearImportSession,
  getImportStatus,
  importErrorMessage,
  importErrorText,
  isDoushProfileUrl,
  loadImportSession,
  saveImportSession,
  startImport,
  verifyImport,
} = await import('@/lib/api/import');

beforeAll(async () => {
  if (!i18n.isInitialized) await initI18n();
});

describe('profile URL validation', () => {
  it.each([
    'https://doushesh.com/users/963997856082',
    'https://www.doushesh.com/users/963997856082/',
    '  https://doushesh.com/users/abc_DEF-123  ',
  ])('accepts %s', url => {
    expect(isDoushProfileUrl(url)).toBe(true);
  });

  it.each([
    '',
    'doushesh.com/users/963997856082',
    'http://doushesh.com/users/963997856082',
    'https://evil.com/users/963997856082',
    'https://doushesh.com.evil.com/users/963997856082',
    'https://doushesh.com@evil.com/users/963997856082',
    'https://doushesh.com/listing/abc-123',
    'https://doushesh.com/users/ab',
    'https://doushesh.com/users/9639/extra',
    'https://doushesh.com/users/963997856082?x=1',
  ])('rejects %s', url => {
    expect(isDoushProfileUrl(url)).toBe(false);
  });
});

describe('consent text', () => {
  it('is the agreed Arabic sentence, word for word', () => {
    expect(ar['import.consent']).toBe(
      'أؤكد أن هذه الإعلانات إعلاناتي، وأوافق على نشرها في سوقنا مع رقم التواصل الموجود فيها.',
    );
  });
});

describe('server error codes', () => {
  it.each(IMPORT_ERROR_CODES)('%s has an Arabic and an English message', code => {
    expect((ar as Record<string, string>)[`import.error.${code}`], code).toBeTruthy();
    expect((en as Record<string, string>)[`import.error.${code}`], code).toBeTruthy();
  });

  it('answers in the current language and falls back for unknown codes', async () => {
    await changeLanguage('ar');
    expect(importErrorText('code_not_found')).toBe(ar['import.error.code_not_found']);
    expect(importErrorText('some_new_code')).toBe(ar['import.error.generic']);
    expect(importErrorText(null)).toBeNull();
    await changeLanguage('en');
    expect(importErrorText('code_not_found')).toBe(en['import.error.code_not_found']);
  });

  it('prefers the server code over the English message of the response', async () => {
    await changeLanguage('ar');
    const error = new axios.AxiosError('Request failed', '429', undefined, undefined, {
      status: 429,
      data: {success: false, code: 'rate_limited_ip', message: 'whatever'},
      statusText: '',
      headers: {},
      config: {} as never,
    });
    expect(importErrorMessage(error)).toBe(ar['import.error.rate_limited_ip']);
  });
});

describe('Arabic plurals for the result lines', () => {
  const KEYS = ['import.importedCount', 'import.skippedCount', 'import.duplicateCount'];
  const COUNTS = [0, 1, 2, 3, 10, 11, 25, 99, 100, 101, 1000];

  it.each(KEYS)('%s resolves for every Arabic plural category', async key => {
    await changeLanguage('ar');
    for (const count of COUNTS) {
      const text = i18n.t(key, {count});
      expect(text, `${key} @ ${count}`).not.toBe(key);
      expect(text, `${key} @ ${count}`).not.toContain('{{');
      expect(text, `${key} @ ${count}`).not.toMatch(/[A-Za-z]{3}/);
    }
  });

  it('uses proper dual and plural wording', async () => {
    await changeLanguage('ar');
    expect(i18n.t('import.importedCount', {count: 1})).toBe('تم تجهيز إعلان واحد للمراجعة');
    expect(i18n.t('import.importedCount', {count: 2})).toBe('تم تجهيز إعلانين للمراجعة');
    expect(i18n.t('import.importedCount', {count: 3})).toBe('تم تجهيز 3 إعلانات للمراجعة');
    expect(i18n.t('import.importedCount', {count: 11})).toBe('تم تجهيز 11 إعلاناً للمراجعة');
  });

  it.each(KEYS)('%s resolves in English', async key => {
    await changeLanguage('en');
    for (const count of COUNTS) {
      expect(i18n.t(key, {count})).not.toBe(key);
    }
  });
});

describe('interpolated strings', () => {
  it('fill in every placeholder in both languages', async () => {
    for (const lng of ['ar', 'en'] as const) {
      await changeLanguage(lng);
      const lines = [
        i18n.t('import.attemptsLeft', {n: 3}),
        i18n.t('import.remaining', {time: '29:59'}),
        i18n.t('import.privacy.body', {email: 'a@b.c'}),
      ];
      for (const line of lines) expect(line, `${lng}: ${line}`).not.toContain('{{');
      expect(lines[0]).toContain('3');
      expect(lines[1]).toContain('29:59');
      expect(lines[2]).toContain('a@b.c');
    }
  });
});

describe('import API client', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    window.sessionStorage.clear();
  });

  it('starts an import with the profile URL and the consent flag', async () => {
    post.mockResolvedValue({
      data: {
        success: true,
        data: {
          request_id: 'r1',
          code: 'SOUQNA-123456',
          expires_at: '2099-01-01T00:00:00+00:00',
          expires_in_minutes: 30,
          profile_id: '963997856082',
          seller_name: 'Damascus real estate',
          max_attempts: 5,
        },
      },
    });

    const result = await startImport('  https://doushesh.com/users/963997856082 ', true);

    expect(post).toHaveBeenCalledWith('import/start', {
      profile_url: 'https://doushesh.com/users/963997856082',
      consent: true,
    });
    expect(result).toMatchObject({requestId: 'r1', code: 'SOUQNA-123456', maxAttempts: 5, sellerName: 'Damascus real estate'});
  });

  it('never sends a phone number or the code back to the server when verifying', async () => {
    post.mockResolvedValue({
      data: {data: {request_id: 'r1', status: 'verifying', error: null, attempts_left: 4, expires_at: 'x', phone_masked: null, ads_found: 0, imported: 0, skipped: 0, duplicates: 0}},
    });
    const progress = await verifyImport('r1');
    expect(post).toHaveBeenCalledWith('import/verify', {request_id: 'r1'});
    expect(progress).toMatchObject({status: 'verifying', attemptsLeft: 4});
  });

  it('reads status counts', async () => {
    get.mockResolvedValue({
      data: {data: {request_id: 'r1', status: 'imported', error: null, attempts_left: 4, expires_at: 'x', phone_masked: '+963 ••• ••• 082', ads_found: 7, imported: 5, skipped: 1, duplicates: 1}},
    });
    const progress = await getImportStatus('r1');
    expect(get).toHaveBeenCalledWith('import/status/r1');
    expect(progress).toMatchObject({imported: 5, skipped: 1, duplicates: 1, phoneMasked: '+963 ••• ••• 082'});
  });
});

describe('keeping the code across a reload', () => {
  const started = {
    requestId: 'r1',
    code: 'SOUQNA-123456',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    expiresInMinutes: 30,
    profileId: '963997856082',
    sellerName: null,
    maxAttempts: 5,
  };

  beforeEach(() => window.sessionStorage.clear());

  it('restores a code that is still valid', () => {
    saveImportSession(started);
    expect(loadImportSession()?.code).toBe('SOUQNA-123456');
  });

  it('drops an expired code', () => {
    saveImportSession({...started, expiresAt: new Date(Date.now() - 1000).toISOString()});
    expect(loadImportSession()).toBeNull();
    expect(window.sessionStorage.getItem('souqna.import.pending')).toBeNull();
  });

  it('can be cleared, and survives unusable storage', () => {
    saveImportSession(started);
    clearImportSession();
    expect(loadImportSession()).toBeNull();

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveImportSession(started)).not.toThrow();
    spy.mockRestore();
  });
});
