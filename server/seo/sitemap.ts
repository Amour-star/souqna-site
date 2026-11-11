import {LISTINGS_PER_SITEMAP, SITE} from './config.js';
import {streamFeed, type Backend} from './backend.js';
import {CITIES, cityPath} from './cities.js';
import {GUIDES} from './guides.js';
import {categoryPath, isIndexableListing, listingPath} from './model.js';
import {categoryIndexable, cityIndexable, comboIndexable, comboKey, subCategoryIndexable, subKey, type SeoStats} from './stats.js';
import {escapeXml, isoDate} from './text.js';

export interface SitemapEntry {
  /** Site-relative path, always starting with "/". */
  path: string;
  lastmod?: string | null;
}

const XMLNS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

/** Absolute, percent-encoded HTTPS URL. Arabic slugs are encoded so the XML is plain ASCII. */
export const absoluteUrl = (path: string): string => `${SITE}${encodeURI(path)}`;

export const urlsetXml = (entries: SitemapEntry[]): string => {
  if (entries.length > 50_000) throw new Error(`sitemap has ${entries.length} URLs (limit 50,000)`);
  const body = entries
    .map(entry => {
      const lastmod = isoDate(entry.lastmod);
      return `  <url>\n    <loc>${escapeXml(absoluteUrl(entry.path))}</loc>${
        lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
      }\n  </url>`;
    })
    .join('\n');
  const xml = `${HEAD}<urlset xmlns="${XMLNS}">\n${body}${body ? '\n' : ''}</urlset>\n`;
  if (Buffer.byteLength(xml) > 45 * 1024 * 1024) throw new Error('sitemap exceeds 45 MB');
  return xml;
};

export const sitemapIndexXml = (files: {path: string; lastmod?: string | null}[]): string => {
  const body = files
    .map(file => {
      const lastmod = isoDate(file.lastmod);
      return `  <sitemap>\n    <loc>${escapeXml(absoluteUrl(file.path))}</loc>${
        lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
      }\n  </sitemap>`;
    })
    .join('\n');
  return `${HEAD}<sitemapindex xmlns="${XMLNS}">\n${body}\n</sitemapindex>\n`;
};

/**
 * Real HTML files in public/ that are worth indexing. Their lastmod is omitted
 * on purpose: we only publish a date we can vouch for.
 */
export const STATIC_PUBLIC_PAGES = ['/how-it-works.html', '/safety.html', '/faq.html', '/support.html', '/privacy.html', '/terms.html'];

export const pagesEntries = (newest: string | null): SitemapEntry[] => [
  {path: '/', lastmod: newest},
  {path: '/guides', lastmod: GUIDES.map(guide => guide.updated).sort().at(-1)},
  ...GUIDES.map(guide => ({path: `/guides/${guide.slug}`, lastmod: guide.updated})),
  ...STATIC_PUBLIC_PAGES.map(path => ({path})),
];

export const categoryEntries = async (backend: Backend, stats: SeoStats): Promise<SitemapEntry[]> => {
  const [categories, subCategories] = await Promise.all([backend.categories(), backend.subCategories()]);
  const entries: SitemapEntry[] = [];
  for (const category of categories) {
    const bucket = stats.categories.get(category.id);
    if (!bucket || !categoryIndexable(bucket.count)) continue;
    entries.push({path: categoryPath(category.id), lastmod: bucket.newest});
  }
  for (const sub of subCategories) {
    const bucket = stats.subCategories.get(subKey(sub.categoryID, sub.id));
    if (!bucket || !subCategoryIndexable(bucket.count)) continue;
    entries.push({path: categoryPath(sub.categoryID, sub.id), lastmod: bucket.newest});
  }
  return entries;
};

export const cityEntries = async (backend: Backend, stats: SeoStats): Promise<SitemapEntry[]> => {
  const categories = await backend.categories();
  const entries: SitemapEntry[] = [];
  for (const city of CITIES) {
    const bucket = stats.cities.get(city.id);
    if (!bucket || !cityIndexable(bucket.count)) continue;
    entries.push({path: cityPath(city), lastmod: bucket.newest});
    for (const category of categories) {
      const combo = stats.combos.get(comboKey(city.id, category.id));
      if (combo && comboIndexable(combo.count)) {
        entries.push({path: cityPath(city, category.id), lastmod: combo.newest});
      }
    }
  }
  return entries;
};

/** Number of listing sitemap files needed for a feed of `total` records. */
export const listingFileCount = (total: number): number => Math.max(1, Math.ceil(total / LISTINGS_PER_SITEMAP));

/**
 * Entries for `sitemap-listings-<n>.xml`: records [(n-1)·size, n·size) of the
 * newest-first feed, streamed page by page, keeping only indexable listings.
 */
export const listingEntries = async (backend: Backend, fileNumber: number, now: Date = new Date()): Promise<SitemapEntry[]> => {
  const from = (fileNumber - 1) * LISTINGS_PER_SITEMAP;
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  for await (const product of streamFeed(backend, from, from + LISTINGS_PER_SITEMAP, 500)) {
    if (seen.has(product.id) || !isIndexableListing(product, now)) continue;
    seen.add(product.id);
    entries.push({path: listingPath(product), lastmod: product.updated_at ?? product.created_at});
  }
  return entries;
};

export const buildIndex = async (backend: Backend): Promise<string> => {
  const {items, total} = await backend.search({}, 1, 1);
  const newest = isoDate(items[0]?.updated_at) ?? isoDate(items[0]?.created_at);
  const files: {path: string; lastmod?: string | null}[] = [
    {path: '/sitemap-pages.xml', lastmod: newest},
    {path: '/sitemap-categories.xml', lastmod: newest},
    {path: '/sitemap-cities.xml', lastmod: newest},
  ];
  for (let n = 1; n <= listingFileCount(total); n += 1) {
    files.push({path: `/sitemap-listings-${n}.xml`, lastmod: n === 1 ? newest : undefined});
  }
  return sitemapIndexXml(files);
};
