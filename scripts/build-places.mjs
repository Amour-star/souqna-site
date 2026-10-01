#!/usr/bin/env node
/**
 * Builds `src/data/syria-places.json`, the offline gazetteer behind the
 * governorate / city / district picker.
 *
 * Why this exists: the Souqna backend has no location table or endpoint (every
 * `/locations`, `/cities`, `/governorates` route 404s) — listings just store a
 * free-text `location` string plus optional lat/long. The mobile app resolves
 * places live against OpenStreetMap Nominatim, which cannot do prefix matching:
 * typing "حل" or "دمش" returns nothing. To give the web an instant Arabic
 * autocomplete, we keep a compact index of real places taken from OpenStreetMap
 * (not typed by hand) and layer live Nominatim results on top for everything
 * that is not in the index.
 *
 * Source: OpenStreetMap via the Overpass API (ODbL). Nothing here is invented.
 * Re-run occasionally:   npm run places
 */
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const OUT = fileURLToPath(new URL('../src/data/syria-places.json', import.meta.url));
const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'souqna-web-build/1.0 (appsouqna@gmail.com)';

/**
 * ISO 3166-2 codes of Syria's 14 governorates, with the English name used only
 * as a lookup key against Nominatim. The Arabic and English display names and
 * the centre coordinates all come back from OpenStreetMap, not from here.
 */
const GOVERNORATES = {
  'SY-DI': 'Damascus',
  'SY-RD': 'Rif Dimashq',
  'SY-HL': 'Aleppo',
  'SY-HI': 'Homs',
  'SY-HM': 'Hama',
  'SY-LA': 'Latakia',
  'SY-TA': 'Tartus',
  'SY-ID': 'Idlib',
  'SY-DR': 'Daraa',
  'SY-SU': 'As-Suwayda',
  'SY-DY': 'Deir ez-Zor',
  'SY-RA': 'Raqqa',
  'SY-HA': 'Al-Hasakah',
  'SY-QU': 'Quneitra',
};

/** Neighbourhood-level places are only indexed for the two cities users name by district. */
const DISTRICT_GOVERNORATES = new Set(['SY-DI', 'SY-HL']);

const ARABIC = /[\u0600-\u06FF]/;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const overpass = async query => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const host = MIRRORS[attempt % MIRRORS.length];
    try {
      const response = await fetch(host, {
        method: 'POST',
        headers: {'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'},
        body: `data=${encodeURIComponent(query)}`,
        // A stalled mirror must not hang the build; move on to the next one.
        signal: AbortSignal.timeout(150_000),
      });
      const text = await response.text();
      if (response.ok && text.trim().startsWith('{')) return JSON.parse(text);
    } catch (error) {
      console.warn(`  ${host} failed (${error.name}); trying another mirror`);
    }
    await sleep(3000 * (attempt + 1));
  }
  throw new Error(`Overpass query failed on every mirror:\n${query}`);
};

/** Nominatim allows one request per second and requires an identifying User-Agent. */
const nominatim = async (params, attempt = 0) => {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams(params)}`, {
    headers: {'User-Agent': UA, Accept: 'application/json'},
    signal: AbortSignal.timeout(30_000),
  });
  if (response.ok) return response.json();
  if (attempt < 3) {
    await sleep(3000 * (attempt + 1));
    return nominatim(params, attempt + 1);
  }
  throw new Error(`Nominatim ${response.status} for ${JSON.stringify(params)}`);
};

const lookupGovernorate = async englishName => {
  const base = {
    q: `${englishName} Governorate, Syria`,
    countrycodes: 'sy',
    featureType: 'state',
    format: 'jsonv2',
    limit: '1',
  };
  const [ar] = await nominatim({...base, 'accept-language': 'ar'});
  await sleep(1100);
  const [en] = await nominatim({...base, 'accept-language': 'en'});
  await sleep(1100);
  if (!ar || !en) throw new Error(`No Nominatim result for ${englishName}`);
  return {
    // Overpass area ids are the OSM relation id + 3.6 billion. Querying by id avoids
    // the ISO 3166-2 tag lookup, which is slow and missing on some relations.
    areaId: 3_600_000_000 + Number(ar.osm_id),
    ar: (ar.name || ar.display_name.split(',')[0]).replace(/^محافظة\s+/, '').trim(),
    en: (en.name || en.display_name.split(',')[0]).replace(/\s+Governorate$/i, '').trim(),
    lat: Number.parseFloat(ar.lat),
    lon: Number.parseFloat(ar.lon),
  };
};

const round = value => Math.round(value * 1e4) / 1e4;

const governorates = [];
const places = [];
const seen = new Set();

for (const [iso, englishName] of Object.entries(GOVERNORATES)) {
  const id = iso.slice(3).toLowerCase();
  const names = await lookupGovernorate(englishName);
  governorates.push({id, ar: names.ar, en: names.en, lat: round(names.lat), lon: round(names.lon)});

  const types = DISTRICT_GOVERNORATES.has(iso)
    ? 'city|town|suburb|neighbourhood|quarter'
    : 'city|town';

  const data = await overpass(`
    [out:json][timeout:120];
    area(${names.areaId})->.a;
    node["place"~"^(${types})$"]["name"](area.a);
    out tags center qt;
  `);

  // Damascus and Aleppo are mapped mostly as boundary polygons (municipalities at
  // admin_level 8, neighbourhoods at 10) rather than `place` nodes.
  const boundaries = DISTRICT_GOVERNORATES.has(iso)
    ? await overpass(`
        [out:json][timeout:120];
        area(${names.areaId})->.a;
        rel["boundary"="administrative"]["admin_level"~"^(8|10)$"]["name"](area.a);
        out tags center qt;
      `)
    : {elements: []};

  for (const element of [...data.elements, ...boundaries.elements]) {
    if (element.type !== 'node' && element.type !== 'relation') continue;
    if (element.type === 'relation' && !element.center) continue;
    // Much of the Syrian map carries Arabic in plain `name` with no `name:ar`.
    const rawAr = (element.tags['name:ar'] || (ARABIC.test(element.tags.name) ? element.tags.name : '')).trim();
    // "بلدية المزة" / "حي المزة" → "المزة": people type the district, not its administrative form.
    const ar = (element.type === 'relation' ? rawAr.replace(/^(بلدية|حي|ضاحية)\s+/, '') : rawAr).trim();
    if (!ar) continue;
    const key = `${id}|${ar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      ar,
      en: element.tags['name:en'] ?? '',
      g: id,
      lat: round(element.lat ?? element.center.lat),
      lon: round(element.lon ?? element.center.lon),
      // c = city, t = town, d = district (suburb / neighbourhood / quarter / boundary)
      k:
        element.type === 'relation'
          ? 'd'
          : element.tags.place === 'city'
            ? 'c'
            : element.tags.place === 'town'
              ? 't'
              : 'd',
      p: Number(element.tags.population) || 0,
    });
  }
  console.log(`${iso} ${names.ar} / ${names.en}: ${places.filter(place => place.g === id).length} places`);
  await sleep(2000);
}

// Larger places first, so equal-quality matches surface the city before a hamlet.
const kindRank = {c: 0, t: 1, d: 2};
places.sort((a, b) => kindRank[a.k] - kindRank[b.k] || b.p - a.p || a.ar.localeCompare(b.ar, 'ar'));

await mkdir(path.dirname(OUT), {recursive: true});
await writeFile(
  OUT,
  `${JSON.stringify({
    source: 'OpenStreetMap contributors (ODbL) via Overpass API',
    generatedAt: new Date().toISOString().slice(0, 10),
    governorates,
    places,
  })}\n`,
);
console.log(`Wrote ${places.length} places / ${governorates.length} governorates to ${OUT}`);
