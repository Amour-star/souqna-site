// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {renderDocument} from '../seo/document.js';
import {resolveRoute} from '../seo/pages.js';
import {CAT_CAR, CAT_RE, NOW, SUB_APT, fakeBackend, makeProduct} from './fixtures.js';
import {listingPath} from '../seo/model.js';
import {checkHtml} from '../seo/health.js';
import {clearTotalsCache} from '../seo/landing.js';

const SHELL = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>سوقنا | سوق سوريا للبيع والشراء</title>
    <meta
      name="description"
      content="generic" />
    <meta property="og:site_name" content="Souqna" />
    <meta property="og:image" content="/logo.png" />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/react-abc.js">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const many = (count: number, extra: Parameters<typeof makeProduct>[0] extends infer T ? Partial<T> : never = {}) =>
  Array.from({length: count}, (_, i) => makeProduct({n: i + 1, ...extra}));

const route = (products: ReturnType<typeof makeProduct>[], path: string, query: Record<string, string> = {}) => {
  clearTotalsCache(); // totals are memoised per warm instance; each test uses its own fake data
  return resolveRoute(fakeBackend(products), {path, query, now: NOW});
};

describe('listing pages', () => {
  const product = makeProduct({n: 7, name: 'شقة للبيع في المزة', price: 52000});
  const canonical = listingPath(product);

  it('serves 200 with unique SEO metadata, Product/Offer JSON-LD and meaningful HTML', async () => {
    const result = await route([product, ...many(8)], canonical);
    expect(result.status).toBe(200);
    const doc = result.doc!;
    expect(doc.indexable).toBe(true);
    expect(doc.canonicalPath).toBe(canonical);
    expect(doc.title).toBe('شقة للبيع في المزة | دمشق | سوقنا');
    expect(doc.description).toContain('شقق في دمشق');
    expect(doc.description).toContain('52,000 دولار');
    expect(doc.description).not.toMatch(/0991|\d{9,}/); // seller phone is stripped from snippets
    const product_ld = doc.ld!.find((entry: any) => entry['@type'] === 'Product') as any;
    expect(product_ld.offers).toMatchObject({'@type': 'Offer', price: 52000, priceCurrency: 'USD', availability: 'https://schema.org/InStock'});
    expect(product_ld.image[0]).toBe('https://backend.souqna.net/productImages/7.jpg');
    expect(product_ld.aggregateRating).toBeUndefined();
    expect(product_ld.review).toBeUndefined();
    expect(doc.ld!.some((entry: any) => entry['@type'] === 'BreadcrumbList')).toBe(true);
    expect(doc.body).toContain('<h1>شقة للبيع في المزة</h1>');
    expect(doc.body).toContain('إعلانات مشابهة');
    expect(doc.body).toMatch(/<a href="\/category\//); // crawlable breadcrumb links
    expect(doc.body).toContain('fetchpriority="high"'); // LCP image is not lazy
  });

  it('gives different listings different titles and descriptions', async () => {
    const a = (await route(many(12), listingPath(many(12)[2]))).doc!;
    const b = (await route(many(12), listingPath(many(12)[3]))).doc!;
    expect(a.title).not.toBe(b.title);
    expect(a.description).not.toBe(b.description);
  });

  it('omits Offer markup when there is no real price (nothing is invented)', async () => {
    const free = makeProduct({n: 9, price: 1}); // "1" is a call-for-price placeholder
    const ld = (await route([free], listingPath(free))).doc!.ld!.find((e: any) => e['@type'] === 'Product') as any;
    expect(ld.offers).toBeUndefined();
    expect(ld.itemCondition).toBeUndefined();
  });

  it('301-redirects any non-canonical slug to the canonical URL', async () => {
    const bare = await route([product], `/listing/${product.id}`);
    expect(bare.status).toBe(301);
    expect(decodeURI(bare.redirect!)).toBe(canonical);
    const stale = await route([product], `/listing/اسم-قديم-${product.id}`);
    expect(stale.status).toBe(301);
    expect((await route([product], encodeURI(canonical))).status).toBe(200); // encoded form is the same URL
  });

  it('answers 404 for unknown/deleted/paused listings and 410 for expired ones — never a soft 404', async () => {
    expect((await route([], `/listing/x-00000000-0000-4000-8000-000000000999`)).status).toBe(404);
    expect((await route([], '/listing/no-id-here')).status).toBe(404);
    const paused = makeProduct({n: 20, status: 2});
    expect((await route([paused], listingPath(paused))).status).toBe(404);
    const expired = makeProduct({n: 21, expDate: '2026-10-01'});
    expect((await route([expired], listingPath(expired))).status).toBe(410);
  });

  it('keeps sold listings reachable but noindex and marked SoldOut', async () => {
    const sold = makeProduct({n: 22, status: 3});
    const result = await route([sold], listingPath(sold));
    expect(result.status).toBe(200);
    expect(result.doc!.indexable).toBe(false);
    const ld = result.doc!.ld!.find((e: any) => e['@type'] === 'Product') as any;
    expect(ld.offers.availability).toBe('https://schema.org/SoldOut');
  });

  it('answers 503 (retry later) instead of an empty 200 when the API is down', async () => {
    const result = await resolveRoute(fakeBackend([product], {failDetail: true}), {path: canonical, query: {}, now: NOW});
    expect(result.status).toBe(503);
  });
});

describe('category and city pages', () => {
  it('category pages are indexable with ItemList markup, subcategory links and pagination', async () => {
    const result = await route(many(60), `/category/${CAT_RE}`);
    expect(result.status).toBe(200);
    expect(result.doc!.indexable).toBe(true);
    expect(result.doc!.title).toContain('عقارات للبيع والإيجار في سوريا');
    expect(result.doc!.body).toContain(`/category/${CAT_RE}/${SUB_APT}`);
    expect(result.doc!.body).toContain(`/category/${CAT_RE}?page=2`);
    expect(result.doc!.body.match(/<h1>/g)).toHaveLength(1);
    const collection = result.doc!.ld!.find((e: any) => e['@type'] === 'CollectionPage') as any;
    expect(collection.mainEntity.itemListElement.length).toBeGreaterThan(0);
    const page2 = await route(many(60), `/category/${CAT_RE}`, {page: '2'});
    expect(page2.doc!.canonicalPath).toBe(`/category/${CAT_RE}?page=2`);
    expect(page2.doc!.title).not.toBe(result.doc!.title);
    expect((await route(many(60), `/category/${CAT_RE}`, {page: '99'})).status).toBe(404);
  });

  it('unknown category, malformed id and unknown city are real 404s', async () => {
    expect((await route(many(3), '/category/ffffffff-ffff-4fff-8fff-ffffffffffff')).status).toBe(404);
    expect((await route(many(3), '/category/not-a-uuid')).status).toBe(404);
    expect((await route(many(3), '/city/atlantis')).status).toBe(404);
  });

  it('thin subcategory / city / combo pages are noindex; substantial ones are indexable', async () => {
    const few = many(4, {categoryID: CAT_CAR});
    expect((await route(few, `/category/${CAT_CAR}`)).doc!.indexable).toBe(true);
    expect((await route(many(2), `/category/${CAT_RE}/${SUB_APT}`)).doc!.indexable).toBe(false); // 2 < 3
    expect((await route(many(5), '/city/damascus')).doc!.indexable).toBe(false); // 5 < 10
    expect((await route(many(40), '/city/damascus')).doc!.indexable).toBe(true);
    const combo = await route(many(40), `/city/damascus/${CAT_RE}`);
    expect(combo.doc!.indexable).toBe(true);
    expect(combo.doc!.title).toBe('عقارات للبيع والإيجار في دمشق | سوقنا');
    expect((await route(many(40), `/city/damascus/${CAT_CAR}`)).doc!.indexable).toBe(false); // 0 cars
  });
});

describe('home, guides and private routes', () => {
  it('home carries Organization + WebSite JSON-LD and links to categories, cities, listings and guides', async () => {
    const result = await route(many(30), '/');
    expect(result.doc!.title).toBe('سوقنا | سوق سوريا للبيع والشراء – سيارات وعقارات وموبايلات');
    const types = result.doc!.ld!.map((e: any) => e['@type']);
    expect(types).toEqual(['Organization', 'WebSite']);
    const org = result.doc!.ld![0] as any;
    expect(org.address).toBeUndefined(); // no invented LocalBusiness address
    expect(org.aggregateRating).toBeUndefined();
    expect(result.doc!.body).toContain('/guides/used-cars-syria');
    expect(result.doc!.body).toContain('/city/damascus');
  });

  it('guides render standalone, with FAQPage + Article markup; unknown guide is 404', async () => {
    const guide = await route([], '/guides/how-to-sell-in-syria');
    expect(guide.status).toBe(200);
    expect(guide.doc!.spa).toBe(false);
    expect(guide.doc!.ld!.map((e: any) => e['@type'])).toEqual(['BreadcrumbList', 'Article', 'FAQPage']);
    expect((await route([], '/guides')).status).toBe(200);
    expect((await route([], '/guides/nope')).status).toBe(404);
  });

  it('account / utility / search routes are noindex shells; unknown paths are 404', async () => {
    for (const path of ['/login', '/register', '/sell', '/sell/abc', '/favorites', '/messages/1', '/profile/settings', '/notifications', '/verify']) {
      const result = await route([], path);
      expect(result.kind, path).toBe('shell');
      expect(result.robots, path).toBe('noindex, nofollow');
      expect(result.status, path).toBe(200);
    }
    expect((await route([], '/search')).robots).toBe('noindex, follow');
    expect((await route([], '/seller/abc')).robots).toBe('noindex, follow');
    expect((await route([], '/definitely/not/a/page')).status).toBe(404);
  });
});

describe('document assembly', () => {
  it('produces exactly one title, description, canonical, robots and og:image — no conflicts with the shell', async () => {
    const product = makeProduct({n: 3});
    const { doc } = await route([product], listingPath(product));
    const html = renderDocument(SHELL, doc!);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html.match(/property="og:image"/g)).toHaveLength(1);
    expect(html).toContain('content="index, follow, max-image-preview:large"');
    expect(html).toContain('data-ssr-path=');
    expect(html).toContain('<html lang="ar" dir="rtl"');
    expect(html).toContain('<div id="root"><main');
    expect(html).toContain('rel="preload" as="image"');
    expect(html).toContain('/assets/index-abc.js'); // SPA still boots
    const result = checkHtml('u', 200, html, listingPath(product));
    expect(result.problems).toEqual([]);
  });

  it('guides drop the SPA bundle; noindex pages say so; JSON-LD cannot break out of its script tag', async () => {
    const guide = (await route([], '/guides/post-free-ad')).doc!;
    const html = renderDocument(SHELL, guide);
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain('modulepreload');

    const evil = makeProduct({n: 5, name: 'x</script><script>alert(1)</script>', description: '</script><b>' + 'z'.repeat(40)});
    const evilDoc = (await route([evil], listingPath(evil))).doc!;
    const evilHtml = renderDocument(SHELL, evilDoc);
    expect(evilHtml).not.toContain('</script><script>alert');
    expect((evilHtml.match(/<script/g) ?? []).length).toBe((evilHtml.match(/<\/script>/g) ?? []).length);

    const thin = renderDocument(SHELL, (await route(many(2), '/city/damascus')).doc!);
    expect(thin).toContain('content="noindex, follow"');
  });
});
