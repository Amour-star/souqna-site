// @vitest-environment node
import {beforeAll, describe, expect, it} from 'vitest';
import {CAT_CAR, CAT_RE, SUB_APT, SUB_SEDAN, NOW, fakeBackend, makeProduct} from './fixtures.js';

/**
 * Sitemap consistency: the sitemap files are compared against an independent
 * statement of "what is eligible" computed straight from the data source, and
 * the same check is repeated for pagination across several listing files.
 */
process.env.SEO_LISTINGS_PER_SITEMAP = '500';

let sitemap: typeof import('../seo/sitemap.js');
let stats: typeof import('../seo/stats.js');
let model: typeof import('../seo/model.js');

beforeAll(async () => {
  sitemap = await import('../seo/sitemap.js');
  stats = await import('../seo/stats.js');
  model = await import('../seo/model.js');
});

const build = () => {
  const products = [];
  // 1,150 healthy listings: Damascus (city 1) + Aleppo (city 24) apartments, a few cars, one in Homs.
  for (let n = 1; n <= 1150; n += 1) {
    products.push(makeProduct({n, city: n % 2 ? 'دمشق' : 'حلب', city_id: n % 2 ? 1 : 24}));
  }
  for (let n = 2000; n < 2004; n += 1) {
    products.push(makeProduct({n, categoryID: CAT_CAR, subCategoryID: SUB_SEDAN, category: {id: CAT_CAR, ar_name: 'السيارات'}, sub_category: {id: SUB_SEDAN, ar_name: 'سيارات سياحية'}, city_id: 1}));
  }
  products.push(makeProduct({n: 3000, city: 'حمص', city_id: 3 + 11})); // a lone listing in a small city
  // Listings that must NOT appear.
  products.push(makeProduct({n: 4000, status: 2}));
  products.push(makeProduct({n: 4001, status: 3}));
  products.push(makeProduct({n: 4002, expDate: '2026-10-01'}));
  products.push(makeProduct({n: 4003, name: '', description: '', images: []}));
  products.push(makeProduct({n: 4004, status: 4}));
  return products;
};

describe('listing sitemaps', () => {
  it('include exactly the eligible listings, once, across every paginated file', async () => {
    const products = build();
    const backend = fakeBackend(products);
    const eligible = new Set(products.filter(p => model.isIndexableListing(p, NOW)).map(p => p.id));

    const { total } = await backend.search({}, 1, 1);
    const files = sitemap.listingFileCount(total);
    expect(files).toBeGreaterThan(2); // pagination really is exercised

    const seen: string[] = [];
    for (let n = 1; n <= files; n += 1) {
      const entries = await sitemap.listingEntries(backend, n, NOW);
      expect(entries.length).toBeLessThanOrEqual(50_000);
      for (const entry of entries) seen.push(entry.path.slice(-36));
    }
    expect(new Set(seen).size).toBe(seen.length); // no duplicates across files
    expect(new Set(seen)).toEqual(eligible);
    for (const id of ['4000', '4001', '4002', '4003', '4004'].map(n => `00000000-0000-4000-8000-${n.padStart(12, '0')}`)) {
      expect(seen).not.toContain(id);
    }
  });

  it('emits valid, absolute, https, percent-encoded XML with accurate lastmod', async () => {
    const products = [makeProduct({n: 1, name: 'شقة & "فاخرة" <للبيع>'})];
    const entries = await sitemap.listingEntries(fakeBackend(products), 1, NOW);
    const xml = sitemap.urlsetXml(entries);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const loc = xml.match(/<loc>([^<]+)<\/loc>/)![1];
    expect(loc.startsWith('https://www.souqna.net/listing/')).toBe(true);
    expect(/^[\x20-\x7e]+$/.test(loc)).toBe(true); // ASCII only → Arabic is percent-encoded
    expect(loc).not.toMatch(/[<>"]/);
    expect(xml).toContain(`<lastmod>${products[0].updated_at}</lastmod>`);
    expect(() => new URL(loc)).not.toThrow();
  });

  it('refuses to exceed the 50,000 URL limit', () => {
    const entries = Array.from({length: 50_001}, (_, i) => ({path: `/listing/x-${i}`}));
    expect(() => sitemap.urlsetXml(entries)).toThrow(/50,000/);
  });

  it('the index references every listing file plus pages, categories and cities', async () => {
    const backend = fakeBackend(build());
    const xml = await sitemap.buildIndex(backend);
    expect(xml).toContain('<sitemapindex');
    for (const name of ['sitemap-pages.xml', 'sitemap-categories.xml', 'sitemap-cities.xml', 'sitemap-listings-1.xml', 'sitemap-listings-3.xml']) {
      expect(xml).toContain(`https://www.souqna.net/${name}`);
    }
  });
});

describe('landing-page eligibility in sitemaps', () => {
  it('lists categories/subcategories with inventory and only cities that reach the threshold', async () => {
    const backend = fakeBackend(build());
    const s = await stats.scanStats(backend, NOW);
    const cats = (await sitemap.categoryEntries(backend, s)).map(e => e.path);
    expect(cats).toContain(`/category/${CAT_RE}`);
    expect(cats).toContain(`/category/${CAT_RE}/${SUB_APT}`);
    expect(cats).toContain(`/category/${CAT_CAR}/${SUB_SEDAN}`); // 4 listings ≥ 3
    expect(cats.some(p => p.includes('33333333'))).toBe(false); // pets: no inventory

    const cities = (await sitemap.cityEntries(backend, s)).map(e => e.path);
    expect(cities).toContain('/city/damascus');
    expect(cities).toContain('/city/aleppo');
    expect(cities).toContain(`/city/damascus/${CAT_RE}`);
    expect(cities).not.toContain(`/city/damascus/${CAT_CAR}`); // 4 cars < 10
    expect(cities.some(p => p.startsWith('/city/homs'))).toBe(false); // 1 listing
  });

  it('never includes private or utility routes', async () => {
    const s = await stats.scanStats(fakeBackend(build()), NOW);
    const all = [...sitemap.pagesEntries(s.newest), ...(await sitemap.categoryEntries(fakeBackend(build()), s))].map(e => e.path);
    for (const bad of ['/login', '/register', '/sell', '/messages', '/profile', '/favorites', '/search', '/api', '/seller']) {
      expect(all.some(p => p === bad || p.startsWith(`${bad}/`))).toBe(false);
    }
  });
});
