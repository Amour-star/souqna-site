/**
 * Syrian location data and search.
 *
 * The backend stores a listing's place as a free-text `location` string plus
 * optional `lat` / `long` — it has no locations table (see
 * `scripts/build-places.mjs`). This module provides the structure the picker
 * needs on top of that contract:
 *
 *  1. an offline gazetteer of governorates / cities / districts taken from
 *     OpenStreetMap, giving instant Arabic prefix autocomplete ("حل" → حلب);
 *  2. live OpenStreetMap Nominatim search — the same source the mobile app
 *     uses — for anything the gazetteer does not contain (villages, streets);
 *  3. a browsable list of Syria's 103 cities, identical to the one the mobile
 *     app's city picker shows, so opening the field (with nothing typed yet)
 *     lists real cities instead of requiring the user to already know what
 *     to search for;
 *  4. helpers that compose and parse the stored `location` string, so listings
 *     created in the app or by hand still open correctly in the editor.
 */

import {SYRIA_CITIES} from '@/data/syria-cities';

export interface Governorate {
  id: string;
  ar: string;
  en: string;
  lat: number;
  lon: number;
}

/** k: c = city, t = town, d = district (suburb / neighbourhood / quarter). */
export interface GazetteerPlace {
  ar: string;
  en: string;
  g: string;
  lat: number;
  lon: number;
  k: 'c' | 't' | 'd';
  p: number;
}

interface Gazetteer {
  governorates: Governorate[];
  places: GazetteerPlace[];
}

export interface PlaceSuggestion {
  /** Stable key for React lists and de-duplication. */
  key: string;
  /** Name in the requested language. */
  name: string;
  /** Governorate id when known. */
  governorateId?: string;
  /** Secondary line, e.g. the governorate. */
  context: string;
  lat: number;
  lon: number;
  source: 'governorate' | 'gazetteer' | 'nominatim';
  /**
   * The backend's stable numeric city id (`SYRIA_CITIES`/`cities` table), set
   * only when this suggestion corresponds exactly to one of the 103 canonical
   * cities — never for a governorate, a village found through Nominatim, or
   * free text. Lets callers (the Sell form, search filters) send a real
   * `city_id` instead of only the free-text `location` string.
   */
  cityId?: number;
}

export type PlaceLanguage = 'ar' | 'en';

// ---------------------------------------------------------------------------
// Arabic-aware text matching
// ---------------------------------------------------------------------------

/**
 * Folds the spelling variants Syrian users mix freely: diacritics, tatweel,
 * alef forms (أ إ آ ٱ), ta marbuta / ha, alef maqsura / ya, and Persian ya /
 * kaf. Latin text is lower-cased so the same function serves English names.
 */
export const normalizeText = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/\s+/g, ' ')
    .trim();

/** Drops the definite article so "باب" finds "الباب" and vice versa. */
const stripArticle = (value: string) => value.replace(/^ال(?=.{2})/, '');

const governorateWord = /^(محافظه|governorate of)\s+/;

const bare = (value: string) => stripArticle(normalizeText(value).replace(governorateWord, ''));

// ---------------------------------------------------------------------------
// Gazetteer (lazy — only fetched once a location field is actually used)
// ---------------------------------------------------------------------------

let gazetteerPromise: Promise<Gazetteer> | null = null;

export const loadGazetteer = (): Promise<Gazetteer> => {
  gazetteerPromise ??= import('@/data/syria-places.json').then(
    module => module.default as unknown as Gazetteer,
  );
  return gazetteerPromise;
};

/** For tests: inject data without touching the network or the bundle. */
export const setGazetteerForTests = (data: Gazetteer | null) => {
  gazetteerPromise = data ? Promise.resolve(data) : null;
};

const rank = (query: string, name: string): number => {
  if (!query) return 3;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(' ').some(word => stripArticle(word).startsWith(query))) return 2;
  return name.includes(query) ? 3 : Infinity;
};

/**
 * Scores a name against what the user has typed so far. Both sides are tried
 * with and without the definite article, because a half-typed "الب" must still
 * find "الباب" while a bare "باب" must find it too.
 */
const scoreName = (rawQuery: string, rawName: string): number => {
  const query = normalizeText(rawQuery).replace(governorateWord, '');
  const name = normalizeText(rawName).replace(governorateWord, '');
  return Math.min(
    rank(query, name),
    rank(stripArticle(query), name),
    rank(query, stripArticle(name)),
    rank(stripArticle(query), stripArticle(name)),
  );
};

/**
 * The cities a user sees when they open the city field without having typed
 * anything: the chosen governorate's cities from `SYRIA_CITIES` (same list,
 * same order the mobile app shows), or — before a governorate is chosen —
 * just the 14 governorate capitals as quick picks. Coordinates come from the
 * matching gazetteer entry when there is one (true for ~90% of the list);
 * otherwise the governorate's centre point is a reasonable stand-in, exactly
 * like picking the governorate alone already falls back to its centre.
 */
const browseCities = (
  {governorates, places}: Gazetteer,
  {governorateId}: {governorateId?: string},
): PlaceSuggestion[] => {
  const byId = new Map(governorates.map(governorate => [governorate.id, governorate]));
  // Syrian place names are shown in Arabic only, whatever the UI language is
  // (see places.ts module doc) — `language` here only affects non-name text.
  const nameOf = (item: {ar: string; en: string}) => item.ar;

  const pool = governorateId
    ? SYRIA_CITIES.filter(city => city.governorateId === governorateId)
    : SYRIA_CITIES.filter(city => city.isPopular);

  return pool.map(city => {
    const governorate = byId.get(city.governorateId);
    const match = places.find(
      place => place.g === city.governorateId && bare(place.ar) === bare(city.ar),
    );
    return {
      key: `city:${city.id}`,
      name: nameOf(city),
      governorateId: city.governorateId,
      context: governorate ? nameOf(governorate) : '',
      lat: match?.lat ?? governorate?.lat ?? 0,
      lon: match?.lon ?? governorate?.lon ?? 0,
      source: 'gazetteer',
      cityId: city.id,
    };
  });
};

/** The canonical city (if any) a gazetteer place corresponds to exactly. */
const canonicalCityFor = (governorateId: string, ar: string): number | undefined =>
  SYRIA_CITIES.find(city => city.governorateId === governorateId && bare(city.ar) === bare(ar))?.id;

export interface LocalSearchOptions {
  language?: PlaceLanguage;
  /** Restrict results to one governorate. */
  governorateId?: string;
  /** Include governorates themselves as results (filters / hero search). */
  includeGovernorates?: boolean;
  limit?: number;
}

export const searchLocalPlaces = async (
  rawQuery: string,
  {language = 'ar', governorateId, includeGovernorates = false, limit = 8}: LocalSearchOptions = {},
): Promise<PlaceSuggestion[]> => {
  const query = rawQuery;
  const gazetteer = await loadGazetteer();
  if (!normalizeText(query)) return browseCities(gazetteer, {governorateId});

  const {governorates, places} = gazetteer;
  const byId = new Map(governorates.map(governorate => [governorate.id, governorate]));
  // Syrian place names are shown in Arabic only, whatever the UI language is.
  const nameOf = (item: {ar: string; en: string}) => item.ar;

  const scored: {score: number; order: number; suggestion: PlaceSuggestion}[] = [];
  let order = 0;

  if (includeGovernorates) {
    for (const governorate of governorates) {
      if (governorateId && governorate.id !== governorateId) continue;
      const score = Math.min(scoreName(query, governorate.ar), scoreName(query, governorate.en));
      if (score === Infinity) continue;
      scored.push({
        // Governorates outrank a same-quality city match: "حلب" means the governorate first.
        score: score - 0.5,
        order: order++,
        suggestion: {
          key: `g:${governorate.id}`,
          name: nameOf(governorate),
          governorateId: governorate.id,
          // Distinguishes "حلب" the governorate from "حلب" the city in the list.
          context: language === 'en' ? 'Governorate' : 'محافظة',
          lat: governorate.lat,
          lon: governorate.lon,
          source: 'governorate',
        },
      });
    }
  }

  for (const place of places) {
    if (governorateId && place.g !== governorateId) continue;
    const score = Math.min(scoreName(query, place.ar), scoreName(query, place.en));
    if (score === Infinity) continue;
    const governorate = byId.get(place.g);
    scored.push({
      score,
      order: order++, // gazetteer is pre-sorted: larger places first
      suggestion: {
        key: `p:${place.g}:${place.ar}`,
        name: nameOf(place),
        governorateId: place.g,
        context: governorate ? nameOf(governorate) : '',
        lat: place.lat,
        lon: place.lon,
        source: 'gazetteer',
        cityId: canonicalCityFor(place.g, place.ar),
      },
    });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map(entry => entry.suggestion);
};

export const listGovernorates = async (): Promise<Governorate[]> =>
  (await loadGazetteer()).governorates;

// ---------------------------------------------------------------------------
// Nominatim (OpenStreetMap) — same source as the mobile app
// ---------------------------------------------------------------------------

const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

const addressTitle = (result: NominatimResult): string =>
  result.name ||
  result.address?.city ||
  result.address?.town ||
  result.address?.village ||
  result.address?.suburb ||
  result.address?.neighbourhood ||
  result.address?.county ||
  result.display_name?.split(',')[0]?.trim() ||
  '';

const matchGovernorate = (
  result: NominatimResult,
  governorates: Governorate[],
): Governorate | undefined => {
  const state = result.address?.state ?? result.address?.province;
  if (!state) return undefined;
  const wanted = bare(state);
  return governorates.find(
    governorate => bare(governorate.ar) === wanted || bare(governorate.en) === wanted,
  );
};

const nominatimCache = new Map<string, PlaceSuggestion[]>();

/**
 * Searches OpenStreetMap, restricted to Syria. Nominatim matches whole words
 * only, so this complements the gazetteer rather than replacing it. Failures
 * resolve to an empty list — autocomplete must degrade to local results, not
 * to an error.
 */
export const searchNominatim = async (
  rawQuery: string,
  {
    language = 'ar',
    governorateId,
    limit = 6,
    signal,
  }: {language?: PlaceLanguage; governorateId?: string; limit?: number; signal?: AbortSignal} = {},
): Promise<PlaceSuggestion[]> => {
  const query = rawQuery.trim();
  if (query.length < 3) return [];

  const {governorates} = await loadGazetteer();
  const scope = governorates.find(governorate => governorate.id === governorateId);
  const q = scope ? `${query} ${language === 'en' ? scope.en : scope.ar}` : query;
  const cacheKey = `${language}|${q}`;
  const cached = nominatimCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    dedupe: '1',
    countrycodes: 'sy',
    // Always Arabic: Syrian place names are shown in Arabic only, whatever
    // the UI language is (see module doc).
    'accept-language': 'ar',
  });

  try {
    const response = await fetch(`${NOMINATIM}/search?${params}`, {
      headers: {Accept: 'application/json'},
      signal,
    });
    if (!response.ok) return [];
    const results = (await response.json()) as NominatimResult[];
    const suggestions = (Array.isArray(results) ? results : [])
      .map((result): PlaceSuggestion | null => {
        const lat = Number.parseFloat(result.lat);
        const lon = Number.parseFloat(result.lon);
        const name = addressTitle(result);
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const governorate = matchGovernorate(result, governorates);
        return {
          key: `n:${result.osm_type ?? ''}${result.osm_id ?? `${lat},${lon}`}`,
          name,
          governorateId: governorate?.id,
          context: governorate ? governorate.ar : '',
          lat,
          lon,
          source: 'nominatim',
        };
      })
      .filter((item): item is PlaceSuggestion => item !== null);
    nominatimCache.set(cacheKey, suggestions);
    return suggestions;
  } catch {
    return [];
  }
};

/**
 * Resolves coordinates (browser geolocation) to a governorate and area name.
 * Mirrors the mobile app's reverse-geocode step.
 */
export const reverseGeocode = async (
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<{governorateId?: string; area: string} | null> => {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '14',
    // Always Arabic: Syrian place names are shown in Arabic only.
    'accept-language': 'ar',
  });
  try {
    const [{governorates}, response] = await Promise.all([
      loadGazetteer(),
      fetch(`${NOMINATIM}/reverse?${params}`, {headers: {Accept: 'application/json'}, signal}),
    ]);
    if (!response.ok) return null;
    const result = (await response.json()) as NominatimResult & {error?: string};
    if (!result || result.error) return null;
    const governorate = matchGovernorate(result, governorates);
    const address = result.address ?? {};
    const area =
      address.suburb ||
      address.neighbourhood ||
      address.city_district ||
      address.city ||
      address.town ||
      address.village ||
      '';
    return {governorateId: governorate?.id, area};
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Stored `location` string
// ---------------------------------------------------------------------------

/** Separator used when composing; matches how existing listings are written. */
export const LOCATION_SEPARATOR = ' – ';

export interface LocationParts {
  governorateId?: string;
  area: string;
  detail: string;
}

/**
 * Listings are read mostly by Arabic speakers and matched with a server-side
 * LIKE, so the stored governorate name is always Arabic, whatever the UI
 * language is.
 */
export const composeLocation = (parts: LocationParts, governorates: Governorate[]): string => {
  const governorate = governorates.find(item => item.id === parts.governorateId);
  return [governorate?.ar ?? '', parts.area, parts.detail]
    .map(part => part.trim())
    .filter(Boolean)
    .join(LOCATION_SEPARATOR);
};

/**
 * Splits a stored location back into governorate / area / detail. Real data
 * mixes separators ("حلب – الباب", "حلب _الباب", "مارع, ناحية مارع, …"), so this
 * is deliberately forgiving: anything it cannot classify is kept as `detail`,
 * which guarantees the original text is never lost when a listing is edited.
 */
export const parseLocation = async (text: string): Promise<LocationParts> => {
  const {governorates, places} = await loadGazetteer();
  const segments = text
    .split(/\s*[–—]\s*|\s*_+\s*|\s*[،,]\s*/)
    .map(segment => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return {area: '', detail: ''};

  const first = bare(segments[0]);
  const governorate = governorates.find(
    item => bare(item.ar) === first || bare(item.en) === first,
  );
  if (!governorate) return {area: '', detail: segments.join(LOCATION_SEPARATOR)};

  const rest = segments.slice(1);
  if (rest.length === 0) return {governorateId: governorate.id, area: '', detail: ''};

  const candidate = bare(rest[0]);
  const isKnownArea = places.some(
    place => place.g === governorate.id && (bare(place.ar) === candidate || bare(place.en) === candidate),
  );
  // An area the gazetteer does not know (a village found through Nominatim) is
  // indistinguishable from a landmark, so it stays in `detail` — the composed
  // string is identical either way.
  return isKnownArea
    ? {governorateId: governorate.id, area: rest[0], detail: rest.slice(1).join(LOCATION_SEPARATOR)}
    : {governorateId: governorate.id, area: '', detail: rest.join(LOCATION_SEPARATOR)};
};
