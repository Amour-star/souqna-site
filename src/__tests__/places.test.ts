import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  composeLocation,
  normalizeText,
  parseLocation,
  searchLocalPlaces,
  searchNominatim,
  setGazetteerForTests,
} from '@/lib/places/places';

const governorates = [
  {id: 'di', ar: 'دمشق', en: 'Damascus', lat: 33.51, lon: 36.29},
  {id: 'hl', ar: 'حلب', en: 'Aleppo', lat: 36.2, lon: 37.16},
  {id: 'hm', ar: 'حماة', en: 'Hama', lat: 35.13, lon: 36.75},
  {id: 'rd', ar: 'ريف دمشق', en: 'Rif Dimashq', lat: 33.6, lon: 36.5},
];

// Pre-sorted the way the build script emits them: larger places first.
const places = [
  {ar: 'حلب', en: 'Aleppo', g: 'hl', lat: 36.2, lon: 37.16, k: 'c' as const, p: 2000000},
  {ar: 'دمشق', en: 'Damascus', g: 'di', lat: 33.51, lon: 36.29, k: 'c' as const, p: 1700000},
  {ar: 'حماة', en: 'Hama', g: 'hm', lat: 35.13, lon: 36.75, k: 'c' as const, p: 800000},
  {ar: 'جرمانا', en: 'Jaramana', g: 'rd', lat: 33.48, lon: 36.35, k: 'c' as const, p: 100000},
  {ar: 'الباب', en: 'Al-Bab', g: 'hl', lat: 36.37, lon: 37.51, k: 't' as const, p: 60000},
  {ar: 'اعزاز', en: "A'zaz", g: 'hl', lat: 36.58, lon: 37.05, k: 't' as const, p: 50000},
  {ar: 'المزة', en: 'Mezzeh', g: 'di', lat: 33.5, lon: 36.25, k: 'd' as const, p: 0},
  {ar: 'برزة', en: 'Barzeh', g: 'di', lat: 33.55, lon: 36.32, k: 'd' as const, p: 0},
  {ar: 'حلبون', en: 'Halboun', g: 'rd', lat: 33.7, lon: 36.2, k: 't' as const, p: 5000},
];

beforeEach(() => setGazetteerForTests({governorates, places}));
afterEach(() => {
  setGazetteerForTests(null);
  vi.unstubAllGlobals();
});

describe('normalizeText', () => {
  it('folds the spelling variants Syrian users mix', () => {
    expect(normalizeText('أعزاز')).toBe(normalizeText('اعزاز'));
    expect(normalizeText('اللاذقية')).toBe(normalizeText('اللاذقيه'));
    expect(normalizeText('حَلَب')).toBe('حلب');
    expect(normalizeText('  Aleppo ')).toBe('aleppo');
  });
});

describe('searchLocalPlaces', () => {
  it('completes a two-letter Arabic prefix: "حل" → حلب first', async () => {
    const results = await searchLocalPlaces('حل');
    expect(results[0].name).toBe('حلب');
    expect(results.map(item => item.name)).toContain('حلبون');
    expect(results.map(item => item.name)).not.toContain('دمشق');
  });

  it('completes "دمش" → دمشق', async () => {
    const results = await searchLocalPlaces('دمش');
    expect(results[0].name).toBe('دمشق');
  });

  it('matches regardless of the definite article', async () => {
    expect((await searchLocalPlaces('باب'))[0].name).toBe('الباب');
    expect((await searchLocalPlaces('الباب'))[0].name).toBe('الباب');
  });

  it('finds a place while the article is only half typed: "الب" → الباب', async () => {
    expect((await searchLocalPlaces('الب'))[0].name).toBe('الباب');
    expect((await searchLocalPlaces('ال'))).not.toHaveLength(0);
  });

  it('matches hamza variants', async () => {
    expect((await searchLocalPlaces('أعزاز'))[0].name).toBe('اعزاز');
  });

  it('carries the governorate as context', async () => {
    const [result] = await searchLocalPlaces('برزة');
    expect(result.context).toBe('دمشق');
    expect(result.governorateId).toBe('di');
  });

  it('scopes to a governorate', async () => {
    const results = await searchLocalPlaces('ا', {governorateId: 'di'});
    expect(results.every(item => item.governorateId === 'di')).toBe(true);
  });

  it('offers governorates ahead of same-name cities when asked', async () => {
    const results = await searchLocalPlaces('حلب', {includeGovernorates: true});
    expect(results[0]).toMatchObject({source: 'governorate', name: 'حلب'});
  });

  it('searches English names when the UI is English', async () => {
    const results = await searchLocalPlaces('alep', {language: 'en'});
    expect(results[0].name).toBe('Aleppo');
  });

  it('returns nothing for an empty query and an unknown one', async () => {
    expect(await searchLocalPlaces('   ')).toEqual([]);
    expect(await searchLocalPlaces('قققق')).toEqual([]);
  });

  it('respects the limit', async () => {
    expect(await searchLocalPlaces('ا', {limit: 2})).toHaveLength(2);
  });
});

describe('composeLocation / parseLocation', () => {
  it('composes in the format existing listings already use', () => {
    expect(composeLocation({governorateId: 'hl', area: 'الباب', detail: ''}, governorates)).toBe(
      'حلب – الباب',
    );
    expect(
      composeLocation({governorateId: 'di', area: 'برزة', detail: 'قرب الجامع'}, governorates),
    ).toBe('دمشق – برزة – قرب الجامع');
    expect(composeLocation({area: '', detail: ''}, governorates)).toBe('');
  });

  it('round-trips what it composes', async () => {
    const parts = {governorateId: 'di', area: 'برزة', detail: 'طريق الحنبلي'};
    const text = composeLocation(parts, governorates);
    expect(await parseLocation(text)).toEqual(parts);
  });

  it('parses legacy strings with mixed separators', async () => {
    expect(await parseLocation('حلب _الباب')).toEqual({
      governorateId: 'hl',
      area: 'الباب',
      detail: '',
    });
    expect(await parseLocation('حلب – تجميل سليمان الحلبي_')).toEqual({
      governorateId: 'hl',
      area: '',
      detail: 'تجميل سليمان الحلبي',
    });
  });

  it('never loses text it cannot classify', async () => {
    const parsed = await parseLocation('مارع, ناحية مارع, منطقة أعزاز, محافظة حلب, سوريا');
    expect(parsed.governorateId).toBeUndefined();
    expect(parsed.detail).toContain('مارع');
    expect(parsed.detail).toContain('سوريا');
  });

  it('treats the governorate word "محافظة" as optional', async () => {
    expect((await parseLocation('محافظة حلب – الباب')).governorateId).toBe('hl');
  });
});

describe('searchNominatim', () => {
  it('ignores queries too short to be useful and never touches the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await searchNominatim('حل')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restricts to Syria and maps results to suggestions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          osm_type: 'node',
          osm_id: 1,
          name: 'كفر حمرة',
          lat: '36.3',
          lon: '37.1',
          address: {state: 'محافظة حلب'},
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchNominatim('كفر حمرة');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('countrycodes')).toBe('sy');
    expect(url.searchParams.get('accept-language')).toBe('ar');
    expect(results).toMatchObject([
      {name: 'كفر حمرة', governorateId: 'hl', context: 'حلب', source: 'nominatim'},
    ]);
  });

  it('biases the query towards the chosen governorate', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => []});
    vi.stubGlobal('fetch', fetchMock);
    await searchNominatim('الحمدانية', {governorateId: 'hl'});
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('q')).toBe('الحمدانية حلب');
  });

  it('degrades to an empty list when the service fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await searchNominatim('حمص الجديدة')).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 429}));
    expect(await searchNominatim('حمص القديمة')).toEqual([]);
  });
});
