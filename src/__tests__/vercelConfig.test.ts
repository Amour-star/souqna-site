import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

/**
 * BUG-02: on Vercel a deep link such as /listing/<slug>-<uuid> has no file behind it,
 * so without an SPA fallback rewrite the platform answers 404 NOT_FOUND.
 * Vercel serves real files (public/ → dist/) BEFORE applying rewrites, so the rewrite
 * only has to (a) catch app routes and (b) leave missing assets as real 404s.
 */
const config = JSON.parse(readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8')) as {
  rewrites: {source: string; destination: string}[];
};
const rule = config.rewrites.find(entry => entry.destination === '/index.html')!;
// Vercel `source` is path-to-regexp; the parenthesised group is a plain regex.
const matches = (url: string) => new RegExp(`^${rule.source}$`).test(url.split('?')[0]);

const UUID = '3f2b6c1e-9d44-4e0b-a5c7-0e5a8d1b2c3f';

describe('vercel.json SPA fallback', () => {
  it('sends every app route to index.html', () => {
    expect(rule.destination).toBe('/index.html');
    for (const url of [
      `/listing/ورشة-تمديد-${UUID}`, `/listing/bmw-320d-${UUID}`, `/category/${UUID}`, `/category/${UUID}/${UUID}`,
      '/sell', '/search?q=bmw', '/search', '/profile/listings', '/messages', '/favorites', '/login', '/some/unknown/path',
    ]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it('does not swallow static files or missing assets', () => {
    for (const url of ['/assets/index-abc123.js', '/assets/missing.css', '/robots.txt', '/sitemap.xml', '/safety.html', '/favicon.ico', '/manifest.webmanifest']) {
      expect(matches(url), url).toBe(false);
    }
  });

  it('static compliance pages and the shell exist in public/ or are built', () => {
    for (const file of ['public/safety.html', 'public/robots.txt', 'public/sitemap.xml', 'index.html']) {
      expect(existsSync(path.resolve(__dirname, '../..', file)), file).toBe(true);
    }
  });
});

describe('listing share-preview rewrite (WEB-03)', () => {
  it('routes /listing/:slug to the meta function before the SPA fallback', () => {
    expect(config.rewrites[0]).toEqual({source: '/listing/:slug', destination: '/api/listing?slug=:slug'});
  });
});
