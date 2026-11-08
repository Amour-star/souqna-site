/**
 * Automated sitemap consistency test: compares the eligibility of every
 * listing in the source of truth (the API the app itself uses) against the
 * listing URLs actually served in the production sitemaps.
 *
 *   npm run seo:consistency
 *
 * Exit 1 when an eligible listing is missing from the sitemap, or a sitemap URL
 * is not eligible (deleted / sold / expired / paused / thin). Listings created or
 * changed in the last SKEW_MINUTES are ignored: the sitemap is edge-cached.
 */
import {httpBackend, streamFeed} from '../server/seo/backend.js';
import {isIndexableListing, listingPath} from '../server/seo/model.js';

const BASE = (process.env.BASE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const SKEW_MS = Number(process.env.SKEW_MINUTES || 20) * 60_000;

const eligible = new Map<string, string>();
const recent = new Set<string>();
const known = new Set<string>();
for await (const product of streamFeed(httpBackend, 0, Number.MAX_SAFE_INTEGER, 1000)) {
  known.add(product.id);
  const changed = Math.max(Date.parse(product.updated_at ?? '') || 0, Date.parse(product.created_at ?? '') || 0);
  if (Date.now() - changed < SKEW_MS) recent.add(product.id);
  if (isIndexableListing(product)) eligible.set(product.id, listingPath(product));
}

const index = await (await fetch(`${BASE}/sitemap.xml`)).text();
const files = [...index.matchAll(/<loc>([^<]*sitemap-listings-\d+\.xml)<\/loc>/g)].map(match => match[1]);
const served = new Map<string, string>();
for (const file of files) {
  const xml = await (await fetch(file.replace('https://www.souqna.net', BASE))).text();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) served.set(match[1].slice(-36), decodeURI(match[1]).replace(/^https:\/\/[^/]+/, ''));
}

const missing = [...eligible.keys()].filter(id => !served.has(id) && !recent.has(id));
const extra = [...served.keys()].filter(id => !eligible.has(id) && !recent.has(id));
const wrongPath = [...served].filter(([id, path]) => eligible.has(id) && eligible.get(id) !== path);

console.log(`API listings scanned:        ${known.size}`);
console.log(`Eligible (indexable):        ${eligible.size}`);
console.log(`Listing sitemap files:       ${files.length}`);
console.log(`Listing URLs in sitemap:     ${served.size}`);
console.log(`Missing from sitemap:        ${missing.length}`);
console.log(`In sitemap but not eligible: ${extra.length} (deleted/sold/expired/paused/thin)`);
console.log(`Non-canonical slug:          ${wrongPath.length}`);
for (const id of missing.slice(0, 10)) console.log(`  missing ${id}`);
for (const id of extra.slice(0, 10)) console.log(`  stale   ${id}`);
process.exit(missing.length || extra.length || wrongPath.length ? 1 : 0);
