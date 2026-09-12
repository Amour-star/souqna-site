/**
 * Generates sitemap.xml from live backend data.
 *
 * Run before deploying (`npm run sitemap`) so search engines see the current
 * categories and active listings. Kept as a build step rather than a runtime
 * route because the site is served as static files.
 */
import {writeFile} from 'node:fs/promises';

const API = process.env.VITE_API_URL || 'https://backend.souqna.net/api';
const SITE = process.env.VITE_SITE_URL || 'https://www.souqna.net';
const PAGE_SIZE = 200;

const slugify = value =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

const escapeXml = value =>
  value.replace(/[<>&'"]/g, character =>
    ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'})[character],
  );

const urlEntry = (path, lastmod, priority) =>
  `  <url>\n    <loc>${escapeXml(`${SITE}${path}`)}</loc>` +
  (lastmod ? `\n    <lastmod>${lastmod.slice(0, 10)}</lastmod>` : '') +
  `\n    <priority>${priority}</priority>\n  </url>`;

const main = async () => {
  const entries = [urlEntry('/', null, '1.0'), urlEntry('/search', null, '0.6')];

  const categoriesResponse = await fetch(`${API}/viewCategories`);
  const categories = (await categoriesResponse.json())?.data ?? [];
  categories.forEach(category => {
    entries.push(urlEntry(`/category/${category.id}`, category.updated_at, '0.8'));
  });

  let page = 1;
  let total = Infinity;
  const listings = [];
  while (listings.length < total && page <= 25) {
    const response = await fetch(`${API}/showProductsWithoutAuth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pageNo: String(page),
        recordsPerPage: String(PAGE_SIZE),
      },
      body: '{}',
    });
    const payload = await response.json();
    const batch = payload?.data ?? [];
    total = payload?.totalRecords ?? batch.length;
    if (!batch.length) break;
    listings.push(...batch);
    page += 1;
  }

  listings
    // Status 0 and 1 are both publicly served by the API; 2/3 are paused/sold.
    .filter(product => [0, 1].includes(Number(product.status)))
    .forEach(product => {
      const slug = slugify(
        [product.name, product.location?.split(',')[0]].filter(Boolean).join(' '),
      );
      entries.push(
        urlEntry(
          slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`,
          product.updated_at,
          '0.7',
        ),
      );
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  await writeFile('public/sitemap.xml', xml, 'utf8');
  console.log(`sitemap.xml written: ${entries.length} urls (${listings.length} listings scanned)`);
};

main().catch(error => {
  console.error('sitemap generation failed:', error.message);
  process.exit(1);
});
