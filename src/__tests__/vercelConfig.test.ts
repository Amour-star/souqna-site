import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

/**
 * Routing contract for Vercel (see docs/seo.md):
 *  - real files (public/ → dist/) are served BEFORE rewrites, so /robots.txt, /faq.html, /assets/* are untouched;
 *  - sitemaps and llms.txt are served by functions;
 *  - every other extension-less path — including "/" — goes to api/page.ts, which returns real
 *    content with the correct status code (200 / 301 / 404 / 410 / 503) instead of an empty shell.
 */
const config = JSON.parse(readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8')) as {
  rewrites: {source: string; destination: string}[];
};
const rule = config.rewrites[config.rewrites.length - 1];
// Vercel `source` is path-to-regexp; the parenthesised group is a plain regex.
const matches = (url: string) => new RegExp(`^${rule.source}$`).test(url.split('?')[0]);

const UUID = '3f2b6c1e-9d44-4e0b-a5c7-0e5a8d1b2c3f';

describe('vercel.json page fallback', () => {
  it('sends every app route, including "/", to the SSR function', () => {
    expect(rule.destination).toBe('/api/page?path=$1');
    for (const url of [
      '/', `/listing/ورشة-تمديد-${UUID}`, `/listing/bmw-320d-${UUID}`, `/category/${UUID}`, `/category/${UUID}/${UUID}`,
      '/city/damascus', '/guides/post-free-ad', '/sell', '/search?q=bmw', '/search', '/profile/listings', '/messages', '/favorites', '/login',
      '/some/unknown/path',
    ]) {
      expect(matches(url), url).toBe(true);
    }
  });

  it('does not swallow static files, functions or missing assets', () => {
    for (const url of [
      '/assets/index-abc123.js', '/assets/missing.css', '/robots.txt', '/sitemap.xml', '/safety.html', '/favicon.ico',
      '/manifest.webmanifest', '/api/ops', '/app-shell.html',
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });

  it('the build renames index.html so "/" cannot be served as a static empty shell', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {scripts: Record<string, string>};
    expect(pkg.scripts.build).toContain('finalize-build');
    expect(readFileSync(path.resolve(__dirname, '../../scripts/finalize-build.mjs'), 'utf8')).toContain('app-shell.html');
  });

  it('static compliance pages and the shell source exist', () => {
    for (const file of ['public/safety.html', 'public/robots.txt', 'index.html', 'api/page.ts', 'api/sitemap.ts', 'api/ops.ts']) {
      expect(existsSync(path.resolve(__dirname, '../..', file)), file).toBe(true);
    }
  });
});

describe('app link association files (share links open the app)', () => {
  it('serves /.well-known untouched by the page fallback', () => {
    expect(matches('/.well-known/apple-app-site-association')).toBe(false);
    expect(matches('/.well-known/assetlinks.json')).toBe(false);
  });

  it('declares the Android package and the iOS app for /listing/*', () => {
    const links = JSON.parse(readFileSync(path.resolve(__dirname, '../../public/.well-known/assetlinks.json'), 'utf8'));
    expect(links[0].target.package_name).toBe('com.souqnaapp');
    expect(links[0].target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);

    const aasa = JSON.parse(readFileSync(path.resolve(__dirname, '../../public/.well-known/apple-app-site-association'), 'utf8'));
    expect(aasa.applinks.details[0].appIDs).toEqual(['T4F3W7P2Y8.app.souqna.app']);
    expect(aasa.applinks.details[0].components[0]['/']).toBe('/listing/*');
  });
});
