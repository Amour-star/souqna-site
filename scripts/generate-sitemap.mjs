/**
 * Generates dynamic XML sitemap index and sub-sitemaps from live backend data.
 *
 * Sitemaps generated:
 *   public/sitemap.xml          -> Root Sitemap Index
 *   public/sitemap_index.xml    -> Alias Sitemap Index
 *   public/sitemap-pages.xml    -> Homepage & informational pages
 *   public/sitemap-categories.xml -> Active categories & subcategories
 *   public/sitemap-cities.xml   -> Syrian city landing pages
 *   public/sitemap-listings-N.xml -> Paginated published listings (1,000 per file)
 */
import {writeFile} from 'node:fs/promises';

const API = (process.env.VITE_API_URL || 'https://backend.souqna.net/api').replace(/\/+$/, '');
const SITE = (process.env.VITE_SITE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const LISTINGS_PER_SITEMAP = 1000;
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
  String(value ?? '').replace(/[<>&'"]/g, character =>
    ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'})[character],
  );

const urlEntry = (path, lastmod, priority, changefreq = 'weekly') => {
  const parts = [`  <url>`, `    <loc>${escapeXml(`${SITE}${path}`)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod.slice(0, 10)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push(`  </url>`);
  return parts.join('\n');
};

const STATIC_PAGES = [
  ['/', '1.0', 'daily'],
  ['/safety.html', '0.7', 'weekly'],
  ['/how-it-works.html', '0.7', 'weekly'],
  ['/faq.html', '0.7', 'weekly'],
  ['/support.html', '0.6', 'monthly'],
  ['/privacy.html', '0.3', 'yearly'],
  ['/terms.html', '0.3', 'yearly'],
];

const SYRIAN_CITIES = [
  {slug: 'damascus', priority: '0.9'},
  {slug: 'aleppo', priority: '0.9'},
  {slug: 'homs', priority: '0.8'},
  {slug: 'hama', priority: '0.8'},
  {slug: 'latakia', priority: '0.8'},
  {slug: 'tartus', priority: '0.8'},
  {slug: 'rif-dimashq', priority: '0.8'},
  {slug: 'qudsaya', priority: '0.7'},
  {slug: 'douma', priority: '0.7'},
  {slug: 'daraa', priority: '0.7'},
  {slug: 'as-suwayda', priority: '0.7'},
  {slug: 'idlib', priority: '0.7'},
  {slug: 'jableh', priority: '0.7'},
  {slug: 'baniyas', priority: '0.7'},
  {slug: 'deir-ez-zor', priority: '0.7'},
  {slug: 'ar-raqqa', priority: '0.7'},
  {slug: 'al-hasakah', priority: '0.7'},
  {slug: 'quneitra', priority: '0.6'},
];

const main = async () => {
  console.log(`Generating sitemaps from API: ${API}`);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Pages Sitemap
  const pageEntries = STATIC_PAGES.map(([path, priority, freq]) =>
    urlEntry(path, today, priority, freq),
  );
  const pagesXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pageEntries.join(
    '\n',
  )}\n</urlset>\n`;
  await writeFile('public/sitemap-pages.xml', pagesXml, 'utf8');
  console.log(`✓ public/sitemap-pages.xml generated (${pageEntries.length} URLs)`);

  // 2. Categories Sitemap
  const categoryEntries = [];
  const [categoriesResponse, subCategoriesResponse] = await Promise.all([
    fetch(`${API}/viewCategories`),
    fetch(`${API}/viewSubCategories`),
  ]);
  const categories = (await categoriesResponse.json())?.data ?? [];
  const subCategories = (await subCategoriesResponse.json())?.data ?? [];

  categories
    .filter(category => Number(category.status) === 1)
    .forEach(category => {
      categoryEntries.push(urlEntry(`/category/${category.id}`, category.updated_at, '0.8', 'daily'));
    });

  subCategories
    .filter(sub => Number(sub.status) === 1 && Number(sub.productsCount ?? sub.products_count ?? 0) > 0)
    .forEach(sub => {
      categoryEntries.push(
        urlEntry(`/category/${sub.categoryID}/${sub.id}`, sub.updated_at, '0.7', 'daily'),
      );
    });

  const categoriesXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${categoryEntries.join(
    '\n',
  )}\n</urlset>\n`;
  await writeFile('public/sitemap-categories.xml', categoriesXml, 'utf8');
  console.log(`✓ public/sitemap-categories.xml generated (${categoryEntries.length} URLs)`);

  // 3. Syrian Cities Sitemap
  const cityEntries = SYRIAN_CITIES.map(c => urlEntry(`/city/${c.slug}`, today, c.priority, 'daily'));
  const citiesXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${cityEntries.join(
    '\n',
  )}\n</urlset>\n`;
  await writeFile('public/sitemap-cities.xml', citiesXml, 'utf8');
  console.log(`✓ public/sitemap-cities.xml generated (${cityEntries.length} URLs)`);

  // 4. Fetch all active listings in batches
  console.log('Fetching active listings from database...');
  let page = 1;
  let totalRecords = Infinity;
  const listings = [];

  while (listings.length < totalRecords && page <= 35) {
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
    const batch = (payload?.data ?? []).filter(p => [0, 1].includes(Number(p.status)));
    totalRecords = Number(payload?.totalRecords) || listings.length;
    if (!batch.length) break;
    listings.push(...batch);
    page += 1;
  }

  console.log(`Fetched ${listings.length} active published listings out of ${totalRecords} total.`);

  // 5. Chunk listings into sitemap-listings-N.xml
  const totalChunks = Math.max(1, Math.ceil(listings.length / LISTINGS_PER_SITEMAP));
  for (let chunk = 1; chunk <= totalChunks; chunk++) {
    const chunkListings = listings.slice(
      (chunk - 1) * LISTINGS_PER_SITEMAP,
      chunk * LISTINGS_PER_SITEMAP,
    );
    const listingEntries = chunkListings.map(product => {
      const slug = slugify(
        [product.name, product.location?.split(/[,–-]/)[0]].filter(Boolean).join(' '),
      );
      const path = slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`;
      return urlEntry(path, product.updated_at || product.created_at, '0.7', 'weekly');
    });

    const chunkXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${listingEntries.join(
      '\n',
    )}\n</urlset>\n`;
    await writeFile(`public/sitemap-listings-${chunk}.xml`, chunkXml, 'utf8');
    console.log(`✓ public/sitemap-listings-${chunk}.xml generated (${listingEntries.length} URLs)`);
  }

  // 6. Generate root Sitemap Index referencing all sub-sitemaps
  const sitemapUrls = [
    `${SITE}/sitemap-pages.xml`,
    `${SITE}/sitemap-categories.xml`,
    `${SITE}/sitemap-cities.xml`,
  ];
  for (let chunk = 1; chunk <= totalChunks; chunk++) {
    sitemapUrls.push(`${SITE}/sitemap-listings-${chunk}.xml`);
  }

  const sitemapIndexEntries = sitemapUrls
    .map(
      loc =>
        `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapIndexEntries}\n</sitemapindex>\n`;

  // Write both public/sitemap.xml AND public/sitemap_index.xml
  await writeFile('public/sitemap.xml', sitemapIndexXml, 'utf8');
  await writeFile('public/sitemap_index.xml', sitemapIndexXml, 'utf8');
  console.log(`✓ public/sitemap.xml and public/sitemap_index.xml written with ${sitemapUrls.length} sitemaps.`);
  console.log(`\n🎉 Total sitemap generation complete! Indexed ${listings.length} listings, ${categoryEntries.length} categories, and ${cityEntries.length} cities.`);
};

main().catch(error => {
  console.error('sitemap generation failed:', error.message);
  process.exit(1);
});
