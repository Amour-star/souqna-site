/**
 * Production SEO validation. Run after every deploy and on a schedule
 * (.github/workflows/seo-validate.yml); exits 1 on any regression.
 *
 *   npm run seo:validate                      # https://www.souqna.net
 *   BASE_URL=https://preview.example npm run seo:validate
 *   SAMPLE=100 npm run seo:validate
 */
import {checkHtml} from '../server/seo/health.js';

const BASE = (process.env.BASE_URL || 'https://www.souqna.net').replace(/\/+$/, '');
const SAMPLE = Number(process.env.SAMPLE || 40);
const failures: string[] = [];
const ok = (message: string) => console.log(`  ✓ ${message}`);
const fail = (message: string) => {
  failures.push(message);
  console.log(`  ✗ ${message}`);
};
const check = (condition: unknown, pass: string, problem: string) => (condition ? ok(pass) : fail(problem));

const get = (path: string, init: RequestInit = {}) =>
  fetch(path.startsWith('http') ? path : `${BASE}${path}`, {redirect: 'manual', signal: AbortSignal.timeout(60_000), ...init});

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const wellFormed = (xml: string, root: string) =>
  xml.startsWith('<?xml') && xml.includes(`<${root}`) && xml.trimEnd().endsWith(`</${root}>`) && !/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(xml);

console.log(`SEO validation for ${BASE}\n`);

console.log('robots.txt');
{
  const response = await get('/robots.txt');
  const text = await response.text();
  check(response.status === 200, 'HTTP 200', `robots.txt HTTP ${response.status}`);
  check(/text\/plain/.test(response.headers.get('content-type') ?? ''), 'text/plain', 'robots.txt is not text/plain');
  check(/^Sitemap:\s*https:\/\/www\.souqna\.net\/sitemap\.xml/im.test(text), 'declares the sitemap', 'robots.txt has no Sitemap line');
  const disallowed = [...text.matchAll(/^Disallow:\s*(\S+)/gim)].map(match => match[1]);
  for (const path of ['/', '/assets/index.js', '/listing/x', '/category/x', '/city/damascus', '/guides/x', '/logo.png']) {
    check(!disallowed.some(rule => path.startsWith(rule.replace(/\$$/, ''))), `${path} is crawlable`, `robots.txt blocks ${path}`);
  }
}

console.log('\nsitemaps');
const urls = new Map<string, string>(); // url → sitemap file
{
  const index = await get('/sitemap.xml');
  const xml = await index.text();
  check(index.status === 200, 'sitemap.xml HTTP 200', `sitemap.xml HTTP ${index.status}`);
  check(/xml/.test(index.headers.get('content-type') ?? ''), 'XML content type', 'sitemap.xml wrong content type');
  check(wellFormed(xml, 'sitemapindex'), 'index is well-formed', 'sitemap index is not well-formed');
  for (const file of locs(xml)) {
    const response = await get(file);
    const body = await response.text();
    const list = locs(body);
    check(response.status === 200 && wellFormed(body, 'urlset'), `${file.replace(BASE, '')} → ${list.length} URLs`, `${file} HTTP ${response.status} / malformed`);
    check(list.length <= 50_000 && body.length < 50 * 1024 * 1024, 'within Google limits', `${file} exceeds 50,000 URLs / 50 MB`);
    for (const url of list) {
      if (!url.startsWith('https://www.souqna.net/') && !url.startsWith(BASE)) fail(`non-canonical host in sitemap: ${url}`);
      if (urls.has(url)) fail(`duplicate URL across sitemaps: ${url}`);
      urls.set(url, file);
    }
  }
  check(urls.size > 0, `${urls.size} unique URLs in total`, 'no URLs in any sitemap');
}

console.log('\npages (raw HTML, no JavaScript)');
{
  const all = [...urls.keys()];
  const byType = (re: RegExp) => all.filter(url => re.test(url));
  const pick = (list: string[], count: number) => {
    const step = Math.max(1, Math.floor(list.length / count));
    return list.filter((_, index) => index % step === 0).slice(0, count);
  };
  const sample = [
    ...pick(byType(/\/listing\//), Math.max(10, SAMPLE - 20)),
    ...pick(byType(/\/category\//), 6),
    ...pick(byType(/\/city\//), 6),
    ...byType(/\/guides/).slice(0, 4),
    `${BASE}/`,
  ];
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const url of sample) {
    const path = decodeURI(new URL(url).pathname);
    const response = await get(url.replace('https://www.souqna.net', BASE));
    const html = await response.text();
    const result = checkHtml(url, response.status, html, path);
    if (/noindex/i.test(response.headers.get('x-robots-tag') ?? '')) result.problems.push('X-Robots-Tag noindex');
    titles.add(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    descriptions.add(html.match(/name="description"\s+content="([^"]*)"/)?.[1] ?? '');
    if (result.problems.length) fail(`${path}: ${result.problems.join('; ')}`);
  }
  check(!failures.some(f => f.startsWith('/')), `${sample.length} sampled URLs: 200, one title/description/canonical/h1, indexable, valid JSON-LD`, 'page problems found (above)');
  check(titles.size === sample.length, 'every sampled page has a unique title', `titles not unique (${titles.size}/${sample.length})`);
  check(descriptions.size === sample.length, 'every sampled page has a unique description', `descriptions not unique (${descriptions.size}/${sample.length})`);
}

console.log('\nstatus codes');
{
  const missing = await get('/listing/does-not-exist-00000000-0000-4000-8000-000000000000');
  check(missing.status === 404, 'unknown listing → 404', `unknown listing → HTTP ${missing.status} (soft 404?)`);
  const unknown = await get('/definitely-not-a-page');
  check(unknown.status === 404, 'unknown path → 404', `unknown path → HTTP ${unknown.status}`);
  const login = await get('/login');
  check(login.status === 200 && /noindex/i.test(login.headers.get('x-robots-tag') ?? ''), '/login → noindex', '/login is indexable');
  const llms = await get('/llms.txt');
  check(llms.status === 200 && /text\/plain/.test(llms.headers.get('content-type') ?? ''), 'llms.txt → 200 text/plain', `llms.txt HTTP ${llms.status}`);
}

console.log(failures.length ? `\n${failures.length} problem(s) found` : '\nAll SEO checks passed');
process.exit(failures.length ? 1 : 0);
