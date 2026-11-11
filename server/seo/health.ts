import {streamFeed, mapLimit, type Backend} from './backend.js';
import {SITE} from './config.js';
import {listingState, listingPath, type Product} from './model.js';
import {listingMeta} from './pages.js';
import {categoryEntries, cityEntries, listingFileCount, pagesEntries} from './sitemap.js';
import {scanStats, type SeoStats} from './stats.js';

export interface PageCheck {
  url: string;
  status: number;
  problems: string[];
}

/** Inspects the raw HTML a crawler receives for one public URL. */
export const checkHtml = (url: string, status: number, html: string, expectedPath: string): PageCheck => {
  const problems: string[] = [];
  if (status !== 200) problems.push(`HTTP ${status}`);
  const titles = html.match(/<title>[\s\S]*?<\/title>/gi) ?? [];
  if (titles.length !== 1 || !/<title>\s*\S/.test(titles[0] ?? '')) problems.push(`title count ${titles.length}`);
  if (!/<meta\s+name="description"\s+content="[^"]{20,}"/i.test(html)) problems.push('missing meta description');
  const canonicals = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/gi)].map(match => match[1]);
  if (canonicals.length !== 1) problems.push(`canonical count ${canonicals.length}`);
  else {
    let decoded = canonicals[0];
    try {
      decoded = decodeURI(decoded);
    } catch {
      /* keep raw */
    }
    if (decoded.replace(/^https?:\/\/[^/]+/, '').split('?')[0] !== expectedPath.split('?')[0]) problems.push(`canonical mismatch (${canonicals[0]})`);
    if (!canonicals[0].startsWith('https://')) problems.push('canonical not https');
  }
  if (/<meta\s+name="robots"[^>]*noindex/i.test(html)) problems.push('noindex on a sitemap URL');
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1 !== 1) problems.push(`h1 count ${h1}`);
  if (!/<html[^>]*lang="ar"/i.test(html)) problems.push('missing lang="ar"');
  for (const block of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      JSON.parse(block[1]);
    } catch {
      problems.push('invalid JSON-LD');
    }
  }
  return {url, status, problems};
};

export interface HealthReport {
  generatedAt: string;
  totals: {scanned: number; indexable: number; states: Record<string, number>};
  sitemap: {pages: number; categories: number; cities: number; listings: number; listingFiles: number; totalUrls: number};
  content: {
    missingTitle: number;
    missingDescription: number;
    missingImages: number;
    missingCity: number;
    missingCategory: number;
    duplicateTitles: number;
    duplicateDescriptions: number;
  };
  sitemapServedAt: string | null;
  deep?: {checked: number; broken: PageCheck[]; lastSuccessfulValidation: string | null};
}

export const buildHealth = async (backend: Backend, options: {deep?: boolean; fetchImpl?: typeof fetch; now?: Date} = {}): Promise<HealthReport> => {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const stats: SeoStats = await scanStats(backend, now);

  const content = {missingTitle: 0, missingDescription: 0, missingImages: 0, missingCity: 0, missingCategory: 0, duplicateTitles: 0, duplicateDescriptions: 0};
  const titles = new Map<string, number>();
  const descriptions = new Map<string, number>();
  const sampleIds: string[] = [];
  let seen = 0;
  for await (const product of streamFeed(backend, 0, Number.MAX_SAFE_INTEGER, 1000)) {
    if (listingState(product, now) !== 'indexable') continue;
    if (!(product.name ?? '').trim()) content.missingTitle += 1;
    if ((product.description ?? '').trim().length < 20) content.missingDescription += 1;
    if (!product.images?.length) content.missingImages += 1;
    if (!product.city && !product.city_id) content.missingCity += 1;
    if (!product.categoryID) content.missingCategory += 1;
    const meta = listingMeta(product);
    titles.set(meta.title, (titles.get(meta.title) ?? 0) + 1);
    descriptions.set(meta.description, (descriptions.get(meta.description) ?? 0) + 1);
    seen += 1;
    // Reservoir-style sample for the live HTML spot check.
    if (sampleIds.length < 20) sampleIds.push(listingPath(product as Product));
    else if (Math.random() < 20 / seen) sampleIds[Math.floor(Math.random() * 20)] = listingPath(product as Product);
  }
  for (const count of titles.values()) if (count > 1) content.duplicateTitles += count;
  for (const count of descriptions.values()) if (count > 1) content.duplicateDescriptions += count;

  const [cats, cities, feed] = await Promise.all([categoryEntries(backend, stats), cityEntries(backend, stats), backend.search({}, 1, 1)]);
  const pages = pagesEntries(stats.newest);
  const sitemap = {
    pages: pages.length,
    categories: cats.length,
    cities: cities.length,
    listings: stats.indexable,
    listingFiles: listingFileCount(feed.total),
    totalUrls: pages.length + cats.length + cities.length + stats.indexable,
  };

  let sitemapServedAt: string | null = null;
  try {
    const head = await fetchImpl(`${SITE}/sitemap.xml`, {method: 'HEAD', signal: AbortSignal.timeout(10_000)});
    const date = Date.parse(head.headers.get('date') ?? '');
    const age = Number(head.headers.get('age') ?? 0);
    if (!Number.isNaN(date)) sitemapServedAt = new Date(date - age * 1000).toISOString();
  } catch {
    /* leave null */
  }

  const report: HealthReport = {
    generatedAt: now.toISOString(),
    totals: {scanned: stats.scanned, indexable: stats.indexable, states: stats.states},
    sitemap,
    content,
    sitemapServedAt,
  };

  if (options.deep) {
    const targets = [...sampleIds, ...cats.slice(0, 10).map(entry => entry.path), ...cities.slice(0, 10).map(entry => entry.path), '/'];
    const checks = await mapLimit(targets, 5, async path => {
      try {
        const response = await fetchImpl(`${SITE}${encodeURI(path)}`, {redirect: 'manual', signal: AbortSignal.timeout(20_000)});
        return checkHtml(`${SITE}${path}`, response.status, await response.text(), path);
      } catch (error) {
        return {url: `${SITE}${path}`, status: 0, problems: [(error as Error).message]} as PageCheck;
      }
    });
    const broken = checks.filter(check => check.problems.length);
    report.deep = {checked: checks.length, broken, lastSuccessfulValidation: broken.length ? null : now.toISOString()};
  }
  return report;
};
