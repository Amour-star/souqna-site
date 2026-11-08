/**
 * Dynamic XML sitemaps, generated from the live API on demand and cached at
 * the CDN edge (stale-while-revalidate), so Google always gets a fast response
 * and the files follow the real catalogue within minutes:
 *
 *   /sitemap.xml                 index
 *   /sitemap-pages.xml           home, guides, public info pages
 *   /sitemap-categories.xml      categories + subcategories with inventory
 *   /sitemap-cities.xml          city and city × category pages with enough inventory
 *   /sitemap-listings-<n>.xml    indexable listings, LISTINGS_PER_SITEMAP per file
 */
import {httpBackend} from '../server/seo/backend.js';
import {first, type Req, type Res} from '../server/seo/http.js';
import {LISTINGS_PER_SITEMAP} from '../server/seo/config.js';
import {buildIndex, categoryEntries, cityEntries, listingEntries, listingFileCount, pagesEntries, urlsetXml} from '../server/seo/sitemap.js';
import {scanStats, type SeoStats} from '../server/seo/stats.js';

let statsMemo: {at: number; value: Promise<SeoStats>} | null = null;
const getStats = (): Promise<SeoStats> => {
  if (!statsMemo || Date.now() - statsMemo.at > 10 * 60 * 1000) {
    const value = scanStats(httpBackend);
    value.catch(() => {
      statsMemo = null;
    });
    statsMemo = {at: Date.now(), value};
  }
  return statsMemo.value;
};

const plain = (res: Res, code: number, text: string, cache = 'no-store') => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.status(code).send(text);
};

export default async function handler(req: Req, res: Res) {
  const file = first(req.query.f) || 'index';
  const number = Number(first(req.query.n) || 1);

  try {
    let xml: string;
    if (file === 'index') xml = await buildIndex(httpBackend);
    else if (file === 'pages') xml = urlsetXml(pagesEntries((await httpBackend.search({}, 1, 1)).items[0]?.updated_at ?? null));
    else if (file === 'categories') xml = urlsetXml(await categoryEntries(httpBackend, await getStats()));
    else if (file === 'cities') xml = urlsetXml(await cityEntries(httpBackend, await getStats()));
    else if (file === 'listings') {
      const {total} = await httpBackend.search({}, 1, 1);
      if (!Number.isInteger(number) || number < 1 || number > listingFileCount(total)) {
        return plain(res, 404, 'Sitemap not found', 'public, s-maxage=300');
      }
      xml = urlsetXml(await listingEntries(httpBackend, number));
    } else {
      return plain(res, 404, 'Sitemap not found');
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=86400');
    res.setHeader('X-Sitemap-Listings-Per-File', String(LISTINGS_PER_SITEMAP));
    res.status(200).send(xml);
  } catch (error) {
    console.error('sitemap failed', file, (error as Error).message);
    res.setHeader('Retry-After', '300');
    plain(res, 503, 'Sitemap temporarily unavailable');
  }
}
