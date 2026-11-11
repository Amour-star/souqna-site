// @vitest-environment node
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {slugify as appSlugify} from '../../src/lib/format.js';
import {CITY_PAGES} from '../../src/lib/cities.js';
import {CITIES} from '../seo/cities.js';
import {GUIDES} from '../seo/guides.js';
import {normaliseUrls} from '../seo/indexnow.js';
import {llmsTxt} from '../seo/llms.js';
import {slugify, stripContactDetails} from '../seo/text.js';
import {categories} from './fixtures.js';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('parity with the browser app', () => {
  it('slugify matches src/lib/format.ts so existing listing URLs never change', () => {
    for (const value of ['شقة للبيع في المزة دمشق', 'BMW 320d – 2015!!', '  a__b  c ', 'x'.repeat(200), 'مرحبا/عالم؟', '']) {
      expect(slugify(value)).toBe(appSlugify(value));
    }
  });
  it('city slugs match src/lib/cities.ts', () => {
    expect(CITIES.map(c => [c.id, c.slug])).toEqual(CITY_PAGES.map(c => [c.id, c.slug]));
    expect(new Set(CITIES.map(c => c.slug)).size).toBe(CITIES.length); // unique
  });
});

describe('robots.txt', () => {
  const robots = read('public/robots.txt');
  const disallowed = robots.split('\n').filter(l => l.startsWith('Disallow:')).map(l => l.slice(9).trim());
  const blocked = (url: string) => disallowed.some(rule => (rule.endsWith('$') ? url === rule.slice(0, -1) : url.startsWith(rule)));

  it('declares the sitemap and allows everything public', () => {
    expect(robots).toContain('Sitemap: https://www.souqna.net/sitemap.xml');
    for (const url of ['/', '/listing/x-1', '/category/1', '/city/damascus', '/guides/post-free-ad', '/assets/index-abc.js', '/assets/index-abc.css', '/logo.png', '/faq.html', '/seller/1', '/llms.txt', '/sitemap.xml']) {
      expect(blocked(url), url).toBe(false);
    }
  });
  it('keeps crawlers out of account and utility routes only', () => {
    for (const url of ['/profile', '/profile/listings', '/messages', '/favorites', '/sell', '/sell/1', '/login', '/register', '/api/ops', '/notifications']) {
      expect(blocked(url), url).toBe(true);
    }
  });
  it('does not block AI search crawlers', () => {
    expect(robots).not.toMatch(/User-agent:\s*(GPTBot|OAI-SearchBot|PerplexityBot|ClaudeBot|Google-Extended|Bingbot)/i);
  });
});

describe('llms.txt, guides, privacy, IndexNow', () => {
  it('llms.txt describes the site and lists real public URLs only', () => {
    const text = llmsTxt(categories);
    expect(text.startsWith('# Souqna – سوقنا')).toBe(true);
    expect(text).toContain('https://www.souqna.net/sitemap.xml');
    expect(text).toContain('https://www.souqna.net/guides/used-cars-syria');
    expect(text).toContain('/city/damascus');
    expect(text).not.toMatch(/\/(login|register|sell|messages|profile)\b/);
  });
  it('every guide is complete: answer, sections, FAQ, valid slug', () => {
    for (const guide of GUIDES) {
      expect(guide.slug).toMatch(/^[a-z0-9-]+$/);
      expect(guide.answer.length).toBeGreaterThan(60);
      expect(guide.sections.length).toBeGreaterThan(1);
      expect(guide.faq.length).toBeGreaterThan(0);
      expect(guide.description.length).toBeLessThanOrEqual(200);
    }
    expect(new Set(GUIDES.map(g => g.slug)).size).toBe(GUIDES.length);
  });
  it('strips phone numbers from snippets', () => {
    expect(stripContactDetails('للتواصل 0991236162 أو +963 991 236 162 شكراً')).not.toMatch(/\d{6}/);
    expect(stripContactDetails('السعر 35000 $ نهائي')).toContain('35000');
  });
  it('IndexNow only accepts https URLs on our own host', () => {
    expect(normaliseUrls(['/listing/a', 'https://evil.example/x', 'http://www.souqna.net/y', 'https://www.souqna.net/ok', 'junk://'])).toEqual([
      'https://www.souqna.net/listing/a',
      'https://www.souqna.net/ok',
    ]);
  });
});

describe('vercel.json routing', () => {
  const config = JSON.parse(read('vercel.json')) as {
    rewrites: {source: string; destination: string}[];
    redirects: {source: string; destination: string}[];
  };
  const page = config.rewrites.at(-1)!;
  const matchesPage = (url: string) => new RegExp(`^${page.source}$`).test(url);

  it('sends / and every app route through the SSR function', () => {
    expect(page.destination).toBe('/api/page?path=$1');
    for (const url of ['/', '/listing/x-1', '/category/1', '/city/damascus', '/guides/post-free-ad', '/sell', '/search', '/unknown']) {
      expect(matchesPage(url), url).toBe(true);
    }
  });
  it('leaves assets, files and well-known paths alone', () => {
    for (const url of ['/assets/index.js', '/robots.txt', '/sitemap.xml', '/faq.html', '/logo.png', '/.well-known/assetlinks.json', '/api/ops', '/app-shell.html']) {
      expect(matchesPage(url), url).toBe(false);
    }
  });
  it('routes every sitemap file and llms.txt to a function, before the page fallback', () => {
    const sources = config.rewrites.map(r => r.source);
    for (const s of ['/sitemap.xml', '/sitemap-pages.xml', '/sitemap-categories.xml', '/sitemap-cities.xml', '/sitemap-listings-:n.xml', '/llms.txt']) {
      expect(sources.indexOf(s), s).toBeGreaterThan(-1);
      expect(sources.indexOf(s), s).toBeLessThan(sources.length - 1);
    }
  });
  it('no stale static sitemap or SPA index.html is left to shadow the functions', () => {
    const { existsSync } = require('node:fs');
    expect(existsSync(path.join(root, 'public/sitemap.xml'))).toBe(false);
    expect(config.redirects.some(r => r.source === '/sitemap_index.xml' && r.destination === '/sitemap.xml')).toBe(true);
  });
});
