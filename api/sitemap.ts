/**
 * Dynamic XML Sitemap System (Phase 2).
 *
 * Implements a dynamic sitemap index and sub-sitemaps querying the live
 * production database via the backend API.
 *
 * Sitemaps:
 *   /sitemap.xml & /sitemap_index.xml -> Sitemap Index
 *   /sitemap-pages.xml                -> Public informational & root pages
 *   /sitemap-categories.xml           -> Active categories & subcategories
 *   /sitemap-cities.xml               -> Supported Syrian city landing pages
 *   /sitemap-listings-:page.xml       -> Paginated published listings (1,000 per sitemap)
 */

interface Req {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): Res;
  send(body: string): void;
}

const API = (process.env.VITE_API_URL || 'https://backend.souqna.net/api').replace(/\/+$/, '');
const SITE = (process.env.VITE_SITE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const LISTINGS_PER_SITEMAP = 1000;
const API_PAGE_SIZE = 200;

export const escapeXml = (value: string): string =>
  String(value ?? '').replace(/[<>&'"]/g, ch => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[ch] as string));

export const slugify = (value: string): string =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

export const listingPath = (product: {id: string; name?: string; location?: string}): string => {
  const slug = slugify([product.name, product.location?.split(/[,–-]/)[0]].filter(Boolean).join(' '));
  return slug ? `/listing/${slug}-${product.id}` : `/listing/${product.id}`;
};

const xmlUrl = (loc: string, lastmod?: string | null, changefreq?: string, priority?: string): string => {
  const parts = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (priority) parts.push(`    <priority>${escapeXml(priority)}</priority>`);
  parts.push(`  </url>`);
  return parts.join('\n');
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

const STATIC_PAGES = [
  {path: '/', priority: '1.0', changefreq: 'daily'},
  {path: '/safety.html', priority: '0.7', changefreq: 'weekly'},
  {path: '/how-it-works.html', priority: '0.7', changefreq: 'weekly'},
  {path: '/faq.html', priority: '0.7', changefreq: 'weekly'},
  {path: '/support.html', priority: '0.6', changefreq: 'monthly'},
  {path: '/privacy.html', priority: '0.3', changefreq: 'yearly'},
  {path: '/terms.html', priority: '0.3', changefreq: 'yearly'},
];

const SYRIAN_CITY_SLUGS = [
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

/** Generates the root Sitemap Index XML referencing all sub-sitemaps */
export async function generateSitemapIndex(): Promise<string> {
  let totalListings = 0;
  try {
    const res = await fetch(`${API}/showProductsWithoutAuth`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', pageNo: '1', recordsPerPage: '1'},
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    totalListings = Number(data?.totalRecords) || 0;
  } catch {
    totalListings = 5000;
  }

  const listingPagesCount = Math.max(1, Math.ceil(totalListings / LISTINGS_PER_SITEMAP));
  const today = new Date().toISOString().slice(0, 10);

  const sitemaps = [
    `${SITE}/sitemap-pages.xml`,
    `${SITE}/sitemap-categories.xml`,
    `${SITE}/sitemap-cities.xml`,
  ];

  for (let i = 1; i <= listingPagesCount; i++) {
    sitemaps.push(`${SITE}/sitemap-listings-${i}.xml`);
  }

  const sitemapEntries = sitemaps
    .map(
      loc =>
        `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</sitemapindex>\n`;
}

/** Generates the Pages sub-sitemap */
export function generatePagesSitemap(): string {
  const entries = STATIC_PAGES.map(p =>
    xmlUrl(`${SITE}${p.path}`, new Date().toISOString(), p.changefreq, p.priority),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
    '\n',
  )}\n</urlset>\n`;
}

/** Generates the Categories and Subcategories sub-sitemap */
export async function generateCategoriesSitemap(): Promise<string> {
  const [catRes, subRes] = await Promise.all([
    fetch(`${API}/viewCategories`, {signal: AbortSignal.timeout(10000)}),
    fetch(`${API}/viewSubCategories`, {signal: AbortSignal.timeout(10000)}),
  ]);

  const categories = ((await catRes.json())?.data ?? []).filter(
    (c: {status: number | string}) => Number(c.status) === 1,
  );
  const subCategories = ((await subRes.json())?.data ?? []).filter(
    (s: {status: number | string; productsCount?: number; products_count?: number}) =>
      Number(s.status) === 1 && Number(s.productsCount ?? s.products_count ?? 0) > 0,
  );

  const entries: string[] = [];

  for (const cat of categories) {
    entries.push(
      xmlUrl(`${SITE}/category/${cat.id}`, cat.updated_at || cat.created_at, 'daily', '0.8'),
    );
  }

  for (const sub of subCategories) {
    entries.push(
      xmlUrl(
        `${SITE}/category/${sub.categoryID}/${sub.id}`,
        sub.updated_at || sub.created_at,
        'daily',
        '0.7',
      ),
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
    '\n',
  )}\n</urlset>\n`;
}

/** Generates the Syrian Cities sub-sitemap */
export function generateCitiesSitemap(): string {
  const entries: string[] = [];

  for (const c of SYRIAN_CITY_SLUGS) {
    entries.push(xmlUrl(`${SITE}/city/${c.slug}`, new Date().toISOString(), 'daily', c.priority));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
    '\n',
  )}\n</urlset>\n`;
}

/** Generates a numbered Listings sub-sitemap chunk */
export async function generateListingsSitemap(chunkNumber: number): Promise<string> {
  const startApiPage = (chunkNumber - 1) * (LISTINGS_PER_SITEMAP / API_PAGE_SIZE) + 1;
  const endApiPage = chunkNumber * (LISTINGS_PER_SITEMAP / API_PAGE_SIZE);

  const products: Array<{id: string; name?: string; location?: string; updated_at?: string; status: number | string}> = [];

  const requests: Promise<void>[] = [];
  for (let page = startApiPage; page <= endApiPage; page++) {
    requests.push(
      (async () => {
        try {
          const res = await fetch(`${API}/showProductsWithoutAuth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              pageNo: String(page),
              recordsPerPage: String(API_PAGE_SIZE),
            },
            body: '{}',
            signal: AbortSignal.timeout(10000),
          });
          const data = await res.json();
          const batch = (data?.data ?? []).filter((p: {status: number | string}) =>
            [0, 1].includes(Number(p.status)),
          );
          products.push(...batch);
        } catch {
          // Skip page if network timeout
        }
      })(),
    );
  }

  await Promise.all(requests);

  const entries = products.map(product => {
    const path = listingPath(product);
    const loc = `${SITE}${encodeURI(decodeURIComponent(path))}`;
    return xmlUrl(loc, product.updated_at, 'weekly', '0.7');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
    '\n',
  )}\n</urlset>\n`;
}

export default async function handler(req: Req, res: Res) {
  const type = first(req.query.type) || 'index';
  const page = parseInt(first(req.query.page) || '1', 10);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  try {
    if (type === 'pages') {
      res.status(200).send(generatePagesSitemap());
      return;
    }
    if (type === 'categories') {
      const xml = await generateCategoriesSitemap();
      res.status(200).send(xml);
      return;
    }
    if (type === 'cities') {
      res.status(200).send(generateCitiesSitemap());
      return;
    }
    if (type === 'listings') {
      const xml = await generateListingsSitemap(page);
      res.status(200).send(xml);
      return;
    }

    // Default: index
    const xml = await generateSitemapIndex();
    res.status(200).send(xml);
  } catch (error) {
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>\n<error>${escapeXml((error as Error).message)}</error>`);
  }
}
